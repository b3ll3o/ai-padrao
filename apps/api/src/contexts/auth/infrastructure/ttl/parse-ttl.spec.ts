import { parseTtlToMs } from "./parse-ttl";

describe("parseTtlToMs", () => {
  it("interpreta segundos", () => {
    expect(parseTtlToMs("30s")).toBe(30_000);
  });

  it("interpreta minutos", () => {
    expect(parseTtlToMs("15m")).toBe(15 * 60_000);
  });

  it("interpreta horas", () => {
    expect(parseTtlToMs("2h")).toBe(2 * 3_600_000);
  });

  it("interpreta dias", () => {
    expect(parseTtlToMs("1d")).toBe(86_400_000);
  });

  it("lança quando falta a unidade", () => {
    expect(() => parseTtlToMs("15")).toThrow("Invalid TTL: 15");
  });

  it("lança quando a unidade é desconhecida", () => {
    expect(() => parseTtlToMs("5y")).toThrow("Invalid TTL: 5y");
  });

  it("lança com string vazia", () => {
    expect(() => parseTtlToMs("")).toThrow("Invalid TTL: ");
  });

  it("lança com números negativos", () => {
    // A regex exige dígitos, então os negativos não passam no match.
    expect(() => parseTtlToMs("-5m")).toThrow("Invalid TTL: -5m");
  });
});
