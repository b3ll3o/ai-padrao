export interface UserAuthRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  passwordHash: string;
}

export interface CreateUserAuthInput {
  email: string;
  name: string;
  passwordHash: string;
}

export interface UserAuthRepositoryPort {
  findByEmail(email: string): Promise<UserAuthRecord | null>;
  findById(id: string): Promise<UserAuthRecord | null>;
  create(input: CreateUserAuthInput): Promise<UserAuthRecord>;
}
