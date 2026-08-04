import type { UserRole as PrismaUserRole } from "@prisma/client";
import { User } from "../../../domain/entities/user";

/**
 * Minimal row shape the mapper needs. Keeping it local — instead of
 * importing the full Prisma `User` type — means callers can pass a
 * partial select (e.g. without `passwordHash`) without fighting the
 * generated types.
 */
export interface PrismaUserRow {
  id: string;
  email: string;
  name: string;
  role: PrismaUserRole;
  createdAt: Date;
  updatedAt: Date;
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
    });
  }
}
