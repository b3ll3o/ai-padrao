import {
  applyDeletedFilter,
  auditExtension,
  auditUserReadHandlers,
  INCLUDE_DELETED_FLAG,
  wrapAuditRead,
} from "./audit-extension";

describe("applyDeletedFilter", () => {
  it("filters all args by `where.deletedAt = null` when caller doesn't override", () => {
    const out = applyDeletedFilter({
      where: { email: "a@a.com" },
    }) as { where: Record<string, unknown> };
    expect(out.where).toEqual({ email: "a@a.com", deletedAt: null });
  });

  it("preserves an explicit deletedAt filter set by the caller", () => {
    const out = applyDeletedFilter({
      where: { deletedAt: { not: null } },
    });
    expect(out).toEqual({ where: { deletedAt: { not: null } } });
  });

  it("opts out of the filter when INCLUDE_DELETED_FLAG is true (and strips the flag)", () => {
    const out = applyDeletedFilter({
      where: { id: "u1", [INCLUDE_DELETED_FLAG]: true },
    }) as { where: Record<string, unknown> };
    expect(out.where).toEqual({ id: "u1" });
    expect(INCLUDE_DELETED_FLAG in (out as object)).toBe(false);
  });

  it("adds the deletedAt filter to where even when caller omits `where`", () => {
    const out = applyDeletedFilter({}) as { where: Record<string, unknown> };
    expect(out.where).toEqual({ deletedAt: null });
  });

  it("passes non-object args through unchanged (defensive)", () => {
    expect(applyDeletedFilter(undefined)).toBeUndefined();
    expect(applyDeletedFilter(null)).toBeNull();
    expect(applyDeletedFilter("not-an-object" as unknown)).toBe(
      "not-an-object",
    );
  });
});

describe("wrapAuditRead", () => {
  it("forwards the filter-rewritten args to the inner query handler", async () => {
    const query = jest.fn(async (args: unknown) => ({ ok: true, args }));
    const result = await wrapAuditRead({
      args: { where: { email: "a@a.com" } },
      query,
    });
    expect(query).toHaveBeenCalledTimes(1);
    const forwarded = query.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
    };
    expect(forwarded.where).toEqual({ email: "a@a.com", deletedAt: null });
    expect(result).toEqual({ ok: true, args: forwarded });
  });

  it("returns whatever the inner query resolves to", async () => {
    const query = jest.fn(async () => "row-1");
    const result = await wrapAuditRead({
      args: { where: { id: "u1" } },
      query,
    });
    expect(result).toBe("row-1");
  });
});

describe("auditExtension", () => {
  it("is a non-null value PrismaClient.$extends can consume", () => {
    // The exact shape returned by `Prisma.defineExtension` is opaque to
    // TypeScript — it has no public `.name` / `.query` accessors. What
    // matters at runtime is that `PrismaClient.$extends(auditExtension)`
    // succeeds, which is exercised indirectly by `PrismaService`
    // construction in integration tests. Here we only assert it's a
    // non-null value so the binding survives import re-orgs.
    expect(auditExtension).toBeDefined();
    expect(auditExtension).not.toBeNull();
  });
});

describe("auditUserReadHandlers", () => {
  // Each named handler in the audit extension must rewrite the caller's
  // args through `applyDeletedFilter` before forwarding. We drive all
  // eight through the same scenario so the spec reads as documentation
  // for which reads are audited.
  const ops = [
    "findUnique",
    "findUniqueOrThrow",
    "findFirst",
    "findFirstOrThrow",
    "findMany",
    "count",
    "aggregate",
    "groupBy",
  ] as const;

  for (const op of ops) {
    it(`${op} rewrites args through applyDeletedFilter and forwards to query`, async () => {
      const query = jest.fn(async (a: unknown) => a);
       
      const handler = auditUserReadHandlers[op] as (p: any) => Promise<unknown>;
      const result = await handler({
        args: { where: { email: "a@a.com" } },
        query,
      });
      expect(query).toHaveBeenCalledTimes(1);
      const forwarded = query.mock.calls[0]?.[0] as {
        where: Record<string, unknown>;
      };
      expect(forwarded.where.deletedAt).toBeNull();
      expect(result).toBe(forwarded);
    });
  }
});
