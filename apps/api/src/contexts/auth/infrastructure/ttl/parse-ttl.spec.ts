import { parseTtlToMs } from "./parse-ttl";

describe("parseTtlToMs", () => {
  it("parses seconds", () => {
    expect(parseTtlToMs("30s")).toBe(30_000);
  });

  it("parses minutes", () => {
    expect(parseTtlToMs("15m")).toBe(15 * 60_000);
  });

  it("parses hours", () => {
    expect(parseTtlToMs("2h")).toBe(2 * 3_600_000);
  });

  it("parses days", () => {
    expect(parseTtlToMs("1d")).toBe(86_400_000);
  });

  it("throws on missing unit", () => {
    expect(() => parseTtlToMs("15")).toThrow("Invalid TTL: 15");
  });

  it("throws on unknown unit", () => {
    expect(() => parseTtlToMs("5y")).toThrow("Invalid TTL: 5y");
  });

  it("throws on empty string", () => {
    expect(() => parseTtlToMs("")).toThrow("Invalid TTL: ");
  });

  it("throws on negative numbers", () => {
    // Match regex requires digits, so negatives fall through.
    expect(() => parseTtlToMs("-5m")).toThrow("Invalid TTL: -5m");
  });
});
