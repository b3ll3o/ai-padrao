// Nest DI + emitDecoratorMetadata need the runtime value here; `import type` erases it.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../../../../infra/prisma/prisma.service";
import type {
  CreateUserAuthInput,
  UserAuthRecord,
  UserAuthRepositoryPort,
} from "../../../domain/ports/user-auth.repository.port";

export class PrismaUserAuthRepository implements UserAuthRepositoryPort {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly prisma: any;

  constructor(prisma: PrismaService) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.prisma = prisma as any;
  }

  async findByEmail(email: string): Promise<UserAuthRecord | null> {
    const row = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    return row ? this.toRecord(row) : null;
  }

  async findById(id: string): Promise<UserAuthRecord | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async create(input: CreateUserAuthInput): Promise<UserAuthRecord> {
    // CREATE is logged to userHistory inside the same transaction so the
    // audit trail is consistent with UPDATE / DELETE / RESTORE (ADR-014).
    const result = await this.prisma.$transaction(async (tx: unknown) => {
      const t = tx as {
        user: {
          create: (args: { data: CreateUserAuthInput }) => Promise<{
            id: string;
            version: number;
          }>;
        };
        userHistory: {
          create: (args: {
            data: {
              originalId: string;
              version: number;
              operation: "CREATE";
              changedAt: Date;
              changedBy: string | null;
              snapshot: unknown;
            };
          }) => Promise<unknown>;
        };
      };
      const row = await t.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash: input.passwordHash,
        },
      });
      await t.userHistory.create({
        data: {
          originalId: row.id,
          version: row.version,
          operation: "CREATE",
          changedAt: new Date(),
          changedBy: null,
          snapshot: row,
        },
      });
      return row;
    });
    return this.toRecord(result);
  }

  private toRecord(row: {
    id: string;
    email: string;
    name: string;
    role: string;
    passwordHash: string;
  }): UserAuthRecord {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      passwordHash: row.passwordHash,
    };
  }
}
