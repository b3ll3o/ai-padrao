import * as argon2 from "argon2";
import type { PasswordHasherPort } from "../../domain/ports/password-hasher.port";

export class Argon2PasswordHasher implements PasswordHasherPort {
  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  verify(plain: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, plain);
  }
}
