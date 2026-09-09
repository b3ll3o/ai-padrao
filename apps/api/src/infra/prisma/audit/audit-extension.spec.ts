import {
  applyDeletedFilter,
  auditExtension,
  auditUserReadHandlers,
  INCLUDE_DELETED_FLAG,
  wrapAuditRead,
} from "./audit-extension";

describe("applyDeletedFilter", () => {
  it("filtra todos os args por `where.deletedAt = null` quando o caller não sobrescreve", () => {
    const out = applyDeletedFilter({
      where: { email: "a@a.com" },
    }) as { where: Record<string, unknown> };
    expect(out.where).toEqual({ email: "a@a.com", deletedAt: null });
  });

  it("preserva um filtro deletedAt explícito definido pelo caller", () => {
    const out = applyDeletedFilter({
      where: { deletedAt: { not: null } },
    });
    expect(out).toEqual({ where: { deletedAt: { not: null } } });
  });

  it("desativa o filtro quando INCLUDE_DELETED_FLAG é true (e remove a flag)", () => {
    const out = applyDeletedFilter({
      where: { id: "u1", [INCLUDE_DELETED_FLAG]: true },
    }) as { where: Record<string, unknown> };
    expect(out.where).toEqual({ id: "u1" });
    expect(INCLUDE_DELETED_FLAG in (out as object)).toBe(false);
  });

  it("adiciona o filtro deletedAt ao where mesmo quando o caller omite `where`", () => {
    const out = applyDeletedFilter({}) as { where: Record<string, unknown> };
    expect(out.where).toEqual({ deletedAt: null });
  });

  it("passa args não-objeto inalterados (defensivo)", () => {
    expect(applyDeletedFilter(undefined)).toBeUndefined();
    expect(applyDeletedFilter(null)).toBeNull();
    expect(applyDeletedFilter("not-an-object" as unknown)).toBe(
      "not-an-object",
    );
  });
});

describe("wrapAuditRead", () => {
  it("encaminha os args reescritos pelo filtro para o handler interno da query", async () => {
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

  it("retorna o que a query interna resolver", async () => {
    const query = jest.fn(async () => "row-1");
    const result = await wrapAuditRead({
      args: { where: { id: "u1" } },
      query,
    });
    expect(result).toBe("row-1");
  });
});

describe("auditExtension", () => {
  it("é um valor não-nulo que PrismaClient.$extends pode consumir", () => {
    // O formato exato retornado por `Prisma.defineExtension` é opaco ao
    // TypeScript — não possui accessors públicos `.name` / `.query`. O que
    // importa em runtime é que `PrismaClient.$extends(auditExtension)`
    // tenha sucesso, o que é exercitado indiretamente pela construção de
    // `PrismaService` nos testes de integração. Aqui só afirmamos que é um
    // valor não-nulo, para que o binding sobreviva a reorganizações de import.
    expect(auditExtension).toBeDefined();
    expect(auditExtension).not.toBeNull();
  });
});

describe("auditUserReadHandlers", () => {
  // Cada handler nomeado na extensão de auditoria deve reescrever os args
  // do caller através de `applyDeletedFilter` antes de encaminhar. Conduzimos
  // todos os oito pelo mesmo cenário para que o spec funcione como
  // documentação de quais reads são auditados.
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
    it(`${op} reescreve args através de applyDeletedFilter e encaminha para a query`, async () => {
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
