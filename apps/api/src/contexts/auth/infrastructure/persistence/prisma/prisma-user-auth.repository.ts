// Nest DI + emitDecoratorMetadata need the runtime value here; `import type` erases it.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../../../../infra/prisma/prisma.service";
import type {
  CreateUserAuthInput,
  UserAuthRecord,
  UserAuthRepositoryPort,
} from "../../../domain/ports/user-auth.repository.port";

export class PrismaUserAuthRepository implements UserAuthRepositoryPort {
   
  constructor(private readonly prisma: PrismaService) {}

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
    const row = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: input.passwordHash,
      },
    });
    return this.toRecord(row);
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
