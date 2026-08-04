// Framework-free role enum. Values mirror @ai-padrao/contracts UserRoleSchema
// (and Prisma's UserRole enum) so adapters can convert without leaking the
// framework enum into the domain.

export type RoleLiteral = "USER" | "ADMIN";

const ROLES: Record<RoleLiteral, RoleLiteral> = {
  USER: "USER",
  ADMIN: "ADMIN",
};

export class UserRole {
  private constructor(readonly value: RoleLiteral) {}

  static readonly USER = new UserRole("USER");
  static readonly ADMIN = new UserRole("ADMIN");

  static from(raw: string): UserRole {
    if (raw === ROLES.USER) return UserRole.USER;
    if (raw === ROLES.ADMIN) return UserRole.ADMIN;
    throw new Error(`Invalid role: ${raw}`);
  }

  isAdmin(): boolean {
    return this.value === "ADMIN";
  }

  toString(): string {
    return this.value;
  }
}
