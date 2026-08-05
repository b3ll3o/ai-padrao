import { createHash } from "node:crypto";
import { Sha256RefreshTokenHasher } from "./sha256-refresh-token.hasher";

describe("Sha256RefreshTokenHasher", () => {
  const hasher = new Sha256RefreshTokenHasher();

  it("returns a hex sha256 digest of the input", () => {
    const expected = createHash("sha256").update("opaque-token").digest("hex");
    expect(hasher.hash("opaque-token")).toBe(expected);
  });

  it("produces a 64-character lowercase hex string", () => {
    const result = hasher.hash("any");
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic — same input yields same hash", () => {
    expect(hasher.hash("repeat-me")).toBe(hasher.hash("repeat-me"));
  });

  it("produces different hashes for different inputs", () => {
    expect(hasher.hash("a")).not.toBe(hasher.hash("b"));
  });
});
