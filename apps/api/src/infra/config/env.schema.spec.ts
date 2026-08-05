import { envSchema } from "./env.schema";

describe("envSchema", () => {
  const base = {
    DATABASE_URL: "postgres://u:p@localhost:5432/d",
    JWT_ACCESS_SECRET: "a".repeat(32),
    JWT_REFRESH_SECRET: "b".repeat(32),
  };

  it("parses a full valid env", () => {
    const parsed = envSchema.parse({
      ...base,
      NODE_ENV: "production",
      API_PORT: 4000,
      JWT_ACCESS_TTL: "5m",
      JWT_REFRESH_TTL: "14d",
      CORS_ORIGINS: "http://localhost:3000,http://localhost:3001",
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel:4318",
      OTEL_SERVICE_NAME: "svc",
      SMTP_HOST: "mail",
      SMTP_PORT: 25,
      SMTP_FROM: "no-reply@example.com",
    });
    expect(parsed.NODE_ENV).toBe("production");
    expect(parsed.API_PORT).toBe(4000);
  });

  it("applies sensible defaults when fields are omitted", () => {
    const parsed = envSchema.parse(base);
    expect(parsed.NODE_ENV).toBe("development");
    expect(parsed.API_PORT).toBe(3001);
    expect(parsed.JWT_ACCESS_TTL).toBe("15m");
    expect(parsed.JWT_REFRESH_TTL).toBe("7d");
    expect(parsed.CORS_ORIGINS).toBe("http://localhost:3000");
    expect(parsed.OTEL_SERVICE_NAME).toBe("ai-padrao-api");
    expect(parsed.SMTP_PORT).toBe(1025);
  });

  it("coerces API_PORT string to number", () => {
    const parsed = envSchema.parse({ ...base, API_PORT: "8080" });
    expect(parsed.API_PORT).toBe(8080);
  });

  it("rejects unknown NODE_ENV", () => {
    expect(() => envSchema.parse({ ...base, NODE_ENV: "staging" })).toThrow();
  });

  it("requires DATABASE_URL", () => {
    const { DATABASE_URL: _drop, ...rest } = base;
    void _drop;
    expect(() => envSchema.parse(rest)).toThrow();
  });

  it("rejects short JWT_ACCESS_SECRET", () => {
    expect(() =>
      envSchema.parse({ ...base, JWT_ACCESS_SECRET: "short" }),
    ).toThrow();
  });

  it("rejects short JWT_REFRESH_SECRET", () => {
    expect(() =>
      envSchema.parse({ ...base, JWT_REFRESH_SECRET: "short" }),
    ).toThrow();
  });
});
