import { auditContext } from "./audit-context";
import type { AuditContext } from "./audit.types";

describe("auditContext (AsyncLocalStorage)", () => {
  it("retorna undefined para actorId quando nenhum contexto está ativo", () => {
    // Fora de qualquer `run`, o storage retorna undefined — padrão defensivo
    // para caminhos de código que ainda não foram envolvidos (scripts CLI,
    // jobs em background, etc.).
    const ctx = auditContext.getStore();
    expect(ctx).toBeUndefined();
  });

  it("propaga um contexto através de boundaries assíncronas e restaura o valor anterior", async () => {
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

      // Depois que o run interno termina, o contexto externo é restaurado.
      seen.push(auditContext.getStore()?.actorId);
    });

    // Depois que o run externo termina, nenhum contexto está ativo novamente.
    expect(auditContext.getStore()).toBeUndefined();
    expect(seen).toEqual([
      "outer-actor",
      "outer-actor",
      "inner-actor",
      "outer-actor",
    ]);
  });
});
