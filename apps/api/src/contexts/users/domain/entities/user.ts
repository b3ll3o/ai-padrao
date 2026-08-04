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
}

interface UserProps {
  id: string;
  email: Email;
  name: Name;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User entity — framework-free. Behavior is limited to what the domain
 * can guarantee: renaming, email changes.
 */
export class User {
  private constructor(private readonly props: UserProps) {}

  static build(p: UserPrimitiveProps): User {
    return new User({
      id: p.id,
      email: Email.create(p.email),
      name: Name.create(p.name),
      role: UserRole.from(p.role),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
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

  toJSON(): UserDto {
    return {
      id: this.props.id,
      email: this.props.email.value,
      name: this.props.name.value,
      role: this.props.role.value,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
