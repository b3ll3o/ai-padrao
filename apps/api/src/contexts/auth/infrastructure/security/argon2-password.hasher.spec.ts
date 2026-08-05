import * as argon2 from "argon2";
import { Argon2PasswordHasher } from "./argon2-password.hasher";

jest.mock("argon2", () => ({
  argon2id: 2,
  hash: jest.fn(),
  verify: jest.fn(),
}));

const mockedArgon2 = argon2 as jest.Mocked<typeof argon2>;

describe("Argon2PasswordHasher", () => {
  const hasher = new Argon2PasswordHasher();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("hashes plaintext using argon2id", async () => {
    mockedArgon2.hash.mockResolvedValue("hashed-value");
    const result = await hasher.hash("plain");
    expect(mockedArgon2.hash).toHaveBeenCalledWith("plain", {
      type: argon2.argon2id,
    });
    expect(result).toBe("hashed-value");
  });

  it("verifies plaintext against a hash using argon2", async () => {
    mockedArgon2.verify.mockResolvedValue(true);
    const result = await hasher.verify("plain", "hash");
    expect(mockedArgon2.verify).toHaveBeenCalledWith("hash", "plain");
    expect(result).toBe(true);
  });

  it("returns false when argon2 verifies mismatch", async () => {
    mockedArgon2.verify.mockResolvedValue(false);
    const result = await hasher.verify("plain", "wrong-hash");
    expect(result).toBe(false);
  });
});
