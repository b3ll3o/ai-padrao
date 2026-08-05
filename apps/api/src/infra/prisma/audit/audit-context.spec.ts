import { auditContext } from "./audit-context";
import type { AuditContext } from "./audit.types";

describe("auditContext (AsyncLocalStorage)", () => {
  it("returns undefined for actorId when no context is active", () => {
    // Outside any `run`, the storage returns undefined — defensive
    // default for code paths that haven't been wrapped yet (CLI scripts,
    // background jobs, etc.).
    const ctx = auditContext.getStore();
    expect(ctx).toBeUndefined();
  });

  it("propagates a context across async boundaries and restores the previous value", async () => {
    const outer: AuditContext = { actorId: "outer-actor" };
    const inner: AuditContext = { actorId: "inner-actor" };

    const seen: Array<string | undefined> = [];

    await auditContext.run(outer, async () => {
      seen.push(auditContext.getStore()?.actorId);
      await Promise.resolve();
      seen.push(auditContext.getStore()?.actorId);

      await auditContext.run(inner, async () => {
        seen.push(auditContext.getStore()?.actorId);
      });

      // After the inner run finishes, the outer context is restored.
      seen.push(auditContext.getStore()?.actorId);
    });

    // After the outer run finishes, no context is active again.
    expect(auditContext.getStore()).toBeUndefined();
    expect(seen).toEqual([
      "outer-actor",
      "outer-actor",
      "inner-actor",
      "outer-actor",
    ]);
  });
});
