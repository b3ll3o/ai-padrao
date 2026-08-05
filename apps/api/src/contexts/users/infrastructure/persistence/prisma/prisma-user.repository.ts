import type { UserListQuery } from "@ai-padrao/contracts";
// Nest DI needs the runtime value here; `import type` erases it from design:paramtypes.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../../../../infra/prisma/prisma.service";
import type { User } from "../../../domain/entities/user";
import type {
  UserListResult,
  UserRepositoryPort,
} from "../../../domain/ports/user-repository.port";
import { UserMapper } from "./user.mapper";

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Prisma-backed implementation of UserRepositoryPort. Lives in
 * infrastructure/persistence/prisma so domain/application stay
 * framework-free.
 */
export class PrismaUserRepository implements UserRepositoryPort {
   
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
      items: rows.map(UserMapper.toDomain),
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
    return row ? UserMapper.toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: USER_SELECT,
    });
    return row ? UserMapper.toDomain(row) : null;
  }

  async update(
    id: string,
    patch: { name?: string; email?: string },
  ): Promise<User> {
    const row = await this.prisma.user.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
      },
      select: USER_SELECT,
    });
    return UserMapper.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}
