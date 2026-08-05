import type { UserRole as PrismaUserRole } from "@prisma/client";
import { User } from "../../../domain/entities/user";

/**
 * Minimal row shape the mapper needs. Keeping it local — instead of
 * importing the full Prisma `User` type — means callers can pass a
 * partial select without fighting the generated types.
 *
 * `deletedAt` / `version` were added per ADR-014 (domain-audit-foundation);
 * both are required for the soft-delete + version contract.
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
 * Conversion between the Prisma row shape (infrastructure concern) and
 * the framework-free User entity (domain). Keeping this isolated means
 * no Prisma types leak into the domain or application layers.
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
