// Enum de role framework-free. Os valores espelham o UserRoleSchema de
// @ai-padrao/contracts (e o enum UserRole do Prisma), para que os
// Adapters possam converter sem vazar o enum do framework no domínio.

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
