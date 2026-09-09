import type { UserRole as PrismaUserRole } from "@prisma/client";
import { User } from "../../../domain/entities/user";

/**
 * Shape mínima da linha que o Mapper precisa. Mantê-la local — em vez de
 * importar o tipo `User` completo do Prisma — significa que os chamadores
 * podem passar um select parcial sem brigar com os tipos gerados.
 *
 * `deletedAt` / `version` foram adicionados conforme ADR-014
 * (domain-audit-foundation); ambos são exigidos pelo contrato de
 * soft-delete + version.
 */
export interface PrismaUserRow {
  id: string;
  email: string;
  name: string;
  role: PrismaUserRole;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  version: number;
}

/**
 * Conversão entre o shape de linha do Prisma (concern de infraestrutura)
 * e a Entity User framework-free (domínio). Manter isso isolado significa
 * que nenhum tipo do Prisma vaza para as camadas de domínio ou
 * Application.
 */
export class UserMapper {
  static toDomain(row: PrismaUserRow): User {
    return User.build({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      version: row.version,
    });
  }
}
