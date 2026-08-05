import type { UserDto } from "@ai-padrao/contracts";
import { Email } from "../value-objects/email";
import { Name } from "../value-objects/name";
import { UserRole } from "../value-objects/user-role";

export interface UserPrimitiveProps {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  version: number;
}

interface UserProps {
  id: string;
  email: Email;
  name: Name;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  version: number;
}

/**
 * User entity — framework-free. Behavior is limited to what the domain
 * can guarantee: renaming, email changes, soft-delete (markDeleted), and
 * restore. All mutations return new immutable instances.
 */
export class User {
  private constructor(private readonly props: UserProps) {}

  static build(p: UserPrimitiveProps): User {
    if (p.version < 0) {
      throw new Error(`User version must be >= 0 (got ${p.version})`);
    }
    if (p.deletedAt && p.deletedAt.getTime() < p.createdAt.getTime()) {
      throw new Error("User deletedAt cannot be earlier than createdAt");
    }
    return new User({
      id: p.id,
      email: Email.create(p.email),
      name: Name.create(p.name),
      role: UserRole.from(p.role),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      deletedAt: p.deletedAt,
      version: p.version,
    });
  }

  get id(): string {
    return this.props.id;
  }
  get email(): Email {
    return this.props.email;
  }
  get name(): Name {
    return this.props.name;
  }
  get role(): UserRole {
    return this.props.role;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }
  get version(): number {
    return this.props.version;
  }

  rename(next: Name): User {
    if (this.props.name.equals(next)) {
      return this;
    }
    return new User({
      ...this.props,
      name: next,
      updatedAt: new Date(),
    });
  }

  changeEmail(next: Email): User {
    if (this.props.email.equals(next)) {
      return this;
    }
    return new User({
      ...this.props,
      email: next,
      updatedAt: new Date(),
    });
  }

  /** Returns a new User marked as soft-deleted at `at`. No-op if already deleted. */
  markDeleted(at: Date): User {
    if (this.props.deletedAt) {
      return this;
    }
    return new User({
      ...this.props,
      deletedAt: at,
      updatedAt: at,
      version: this.props.version + 1,
    });
  }

  /** Returns a new User with the soft-delete cleared. No-op if not deleted. */
  restore(): User {
    if (!this.props.deletedAt) {
      return this;
    }
    const now = new Date();
    return new User({
      ...this.props,
      deletedAt: null,
      updatedAt: now,
      version: this.props.version + 1,
    });
  }

  toJSON(): UserDto {
    return {
      id: this.props.id,
      email: this.props.email.value,
      name: this.props.name.value,
      role: this.props.role.value,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
      deletedAt: this.props.deletedAt,
      version: this.props.version,
    };
  }
}
