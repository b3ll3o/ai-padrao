import type { UserHistoryEntry, UserListQuery } from "@ai-padrao/contracts";
// Nest DI precisa do valor em tempo de execução aqui; `import type` o apaga de design:paramtypes.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../../../../infra/prisma/prisma.service";
import { INCLUDE_DELETED_FLAG } from "../../../../../infra/prisma/audit/audit-extension";
import type { User } from "../../../domain/entities/user";
import { UserNotDeletedError } from "../../../domain/errors/user-not-deleted.error";
import { UserNotFoundError } from "../../../domain/errors/user-not-found.error";
import type {
  UserListResult,
  UserRepositoryPort,
} from "../../../domain/ports/user-repository.port";
import { UserMapper, type PrismaUserRow } from "./user.mapper";

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  version: true,
} as const;

type AuditOperation = "UPDATE" | "DELETE" | "RESTORE";

interface AuditEntryInput {
  originalId: string;
  version: number;
  operation: AuditOperation;
  changedAt: Date;
  changedBy: string | null;
  snapshot: PrismaUserRow;
}

/**
 * Implementação baseada em Prisma do {@link UserRepositoryPort}.
 *
 * Mora em `infrastructure/persistence/prisma` para que domain/application
 * permaneçam framework-free.
 *
 * Semântica de audit (conforme ADR-014):
 *  - Linhas soft-deleted são transparentes para `findById`, `findByEmail`
 *    e `list` — o `auditExtension` injeta `deletedAt: null`.
 *  - `findByIdIncludingDeleted` desativa esse filtro via o sentinel
 *    `INCLUDE_DELETED_FLAG`.
 *  - Toda escrita que muta a linha (`update`, `softDelete`, `restore`)
 *    roda dentro de `prisma.$transaction`: lê o estado anterior, persiste
 *    a mutação com `version: { increment: 1 }`, e então escreve uma linha
 *    em `userHistory` com o snapshot + a operação aplicada.
 */
export class PrismaUserRepository implements UserRepositoryPort {
  private readonly INCLUDE_DELETED: any = { [INCLUDE_DELETED_FLAG]: true };

  constructor(private readonly prisma: PrismaService) {}

  async list(query: UserListQuery): Promise<UserListResult> {
    const { page, pageSize, q } = query;
    const where = q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: USER_SELECT,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: rows.map((row) => UserMapper.toDomain(row as PrismaUserRow)),
      total,
      page,
      pageSize,
    };
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    return row ? UserMapper.toDomain(row as PrismaUserRow) : null;
  }

  async findByIdIncludingDeleted(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({
      where: { id, ...this.INCLUDE_DELETED } as never,
      select: USER_SELECT,
    });
    return row ? UserMapper.toDomain(row as PrismaUserRow) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: USER_SELECT,
    });
    return row ? UserMapper.toDomain(row as PrismaUserRow) : null;
  }

  async update(
    id: string,
    patch: { name?: string; email?: string },
    actorId?: string,
  ): Promise<User> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const prior = (await tx.user.findUnique({
        where: { id },
        select: USER_SELECT,
      })) as PrismaUserRow | null;
      if (!prior) throw new UserNotFoundError(id);

      const next = (await tx.user.update({
        where: { id },
        data: {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.email !== undefined ? { email: patch.email } : {}),
          version: { increment: 1 },
        },
        select: USER_SELECT,
      })) as PrismaUserRow;

      await this.writeHistory(tx, {
        originalId: prior.id,
        version: next.version,
        operation: "UPDATE",
        changedAt: new Date(),
        changedBy: actorId ?? null,
        snapshot: prior,
      });
      return next;
    });
    return UserMapper.toDomain(updated as PrismaUserRow);
  }

  async softDelete(id: string, actorId?: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const prior = (await tx.user.findUnique({
        where: { id },
        select: USER_SELECT,
      })) as PrismaUserRow | null;
      if (!prior) throw new UserNotFoundError(id);

      const next = (await tx.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          version: { increment: 1 },
        },
        select: USER_SELECT,
      })) as PrismaUserRow;

      await this.writeHistory(tx, {
        originalId: prior.id,
        version: next.version,
        operation: "DELETE",
        changedAt: new Date(),
        changedBy: actorId ?? null,
        snapshot: prior,
      });
    });
  }

  async restore(id: string, actorId?: string): Promise<User> {
    const restored = await this.prisma.$transaction(async (tx) => {
      const prior = (await tx.user.findUnique({
        where: { id, ...this.INCLUDE_DELETED } as never,
        select: USER_SELECT,
      })) as PrismaUserRow | null;
      if (!prior) throw new UserNotFoundError(id);
      if (prior.deletedAt === null) throw new UserNotDeletedError(id);

      const next = (await tx.user.update({
        where: { id },
        data: {
          deletedAt: null,
          version: { increment: 1 },
        },
        select: USER_SELECT,
      })) as PrismaUserRow;

      await this.writeHistory(tx, {
        originalId: prior.id,
        version: next.version,
        operation: "RESTORE",
        changedAt: new Date(),
        changedBy: actorId ?? null,
        snapshot: prior,
      });
      return next;
    });
    return UserMapper.toDomain(restored as PrismaUserRow);
  }

  async getHistory(id: string): Promise<UserHistoryEntry[]> {
    const rows = await this.prisma.userHistory.findMany({
      where: { originalId: id },
      orderBy: { version: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      originalId: row.originalId,
      version: row.version,
      operation: row.operation as UserHistoryEntry["operation"],
      changedAt: row.changedAt,
      changedBy: row.changedBy,
      snapshot: row.snapshot as UserHistoryEntry["snapshot"],
    }));
  }

  private async writeHistory(
    tx: Parameters<PrismaService["$transaction"]>[0] extends (
      cb: infer C,
    ) => unknown
      ? C
      : never,
    entry: AuditEntryInput,
  ): Promise<void> {
    // O client da transaction expõe o model `userHistory` tipado da
    // mesma forma que o client top-level.
    await (tx as unknown as PrismaService).userHistory.create({
      data: entry as never,
    });
  }
}
