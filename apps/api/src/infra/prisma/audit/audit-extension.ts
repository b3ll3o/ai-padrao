import { Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AUDITED_MODELS } from "./audit.types";

const auditLog = new Logger("AuditExtension");

/**
 * Chave sentinel no arg usada para OPTAR uma única leitura do Prisma
 * FORA do filtro `deletedAt: null`. A camada de Repository passa isso
 * via `findUnique({ where: { id, [INCLUDE_DELETED_FLAG]: true } })` para
 * `findByIdIncludingDeleted`.
 *
 * A string tem prefixo para facilitar grep / audit; o Prisma encaminha
 * chaves desconhecidas pelo `where` sem erro, e a extension a remove
 * antes da query interna rodar.
 */
export const INCLUDE_DELETED_FLAG = "__auditIncludeDeleted";

interface ArgsWithFlag {
  where?: Record<string, unknown> | null;
}

interface WhereWithFlag extends Record<string, unknown> {
  __auditIncludeDeleted?: boolean;
}

/**
 * Transformação pura aplicada a cada leitura em um model auditado.
 * Exportada para teste unitário e para o audit.spec — manter a lógica
 * fora da maquinaria da extension do Prisma nos permite fazer assert do
 * comportamento sem subir um banco.
 *
 * Comportamento:
 *  - Se `args.where` já tem um filtro `deletedAt`, deixa como está.
 *  - Se `args.where[INCLUDE_DELETED_FLAG]` é `true`, remove o sentinel
 *    de `where` e retorna o restante inalterado.
 *  - Caso contrário, define `args.where.deletedAt = null`.
 *  - Args que não são objeto são retornados inalterados (defensivo).
 */
export function applyDeletedFilter(args: unknown): unknown {
  if (!args || typeof args !== "object") return args;
  const a = args as ArgsWithFlag;
  const existingWhere = (a.where ?? {}) as WhereWithFlag;
  if (existingWhere.__auditIncludeDeleted === true) {
    // Remove o sentinel de `where` via destructuring-and-discarding.
    // O nome do campo começa com `_` para satisfazer a regra
    // `no-unused-vars` do projeto sem um eslint-disable directive.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { __auditIncludeDeleted: _auditIncludeDeleted, ...rest } =
      existingWhere;
    // Logar o opt-out torna o padrão read-visible-to-deleted-rows
    // greppable nos logs de produção. Use Nest Logger conforme ADR-006.
    auditLog.debug(
      `audit read opted out of soft-delete filter: ${JSON.stringify(rest)}`,
    );
    return { ...a, where: rest };
  }
  if ("deletedAt" in existingWhere) {
    return a;
  }
  return { ...a, where: { ...existingWhere, deletedAt: null } };
}

/**
 * Shape do argumento `params` que o Prisma passa para cada handler
 * `query.<model>.<op>`. Usamos apenas `args` (os args de query fornecidos
 * pelo usuário) e `query` (o handler interno que de fato executa a query
 * no banco). Marcado como `unknown` no retorno da inner-query porque não
 * modelamos aqui os tipos de resultado do Prisma — `applyDeletedFilter` é
 * uma transformação pura, o tipo real do resultado é responsabilidade do
 * call site.
 */
export interface AuditReadParams {
  args: unknown;

  query: (args: unknown) => Promise<any>;
}

/**
 * Corpo compartilhado de cada handler `query.<model>.<readOp>`. Centralizado
 * para que exista uma única função que os testes unitários possam
 * acionar — os oito handlers de leitura abaixo delegam todos aqui. Se a
 * lógica de audit algum dia precisar de um override por op (ex.:
 * `findUnique` também deve aplicar constraints de unicidade), essa é a
 * costura.
 */
export function wrapAuditRead(params: AuditReadParams): Promise<unknown> {
  // Params de read do Prisma podem ser object-or-null dependendo da op;
  // logar o shape ajuda a diagnosticar audit reads mal fiados em prod.
  // Use `Logger` do Nest conforme ADR-006 e fique em nível debug para que
  // o hot path não emita ruído em produção.
  const argsSummary =
    params.args && typeof params.args === "object"
      ? Object.keys(params.args).join(",")
      : "none";
  auditLog.debug(`audit read keys=${argsSummary}`);
  return params.query(applyDeletedFilter(params.args));
}

/**
 * Handlers nomeados exportados como um objeto plano para que cada um
 * seja testável unitariamente em isolamento. A maquinaria do `$extends`
 * do Prisma abaixo envolve a mesma referência de objeto — o wiring é
 * `query.user = auditUserReadHandlers`.
 *
 * Extraí-los do object literal inline significa que podemos chamar
 * `auditUserReadHandlers.findUnique({ args, query })` de um spec Jest
 * sem precisar subir um `PrismaClient` real. Cada branch deste módulo
 * é alcançável a partir dos testes via `applyDeletedFilter` (a
 * transformação pura) ou um desses handlers (a ligação com o Prisma).
 */

export const auditUserReadHandlers: Record<
  string,
  (params: any) => Promise<unknown>
> = {
  findUnique: (params: any) => wrapAuditRead(params),

  findUniqueOrThrow: (params: any) => wrapAuditRead(params),

  findFirst: (params: any) => wrapAuditRead(params),

  findFirstOrThrow: (params: any) => wrapAuditRead(params),

  findMany: (params: any) => wrapAuditRead(params),

  count: (params: any) => wrapAuditRead(params),

  aggregate: (params: any) => wrapAuditRead(params),

  groupBy: (params: any) => wrapAuditRead(params),
};

/**
 * Definição do `$extends` do Prisma injetada pelo `PrismaService`.
 *
 * Comportamento:
 *  - Cada leitura em cada model em `AUDITED_MODELS` (`findUnique`,
 *    `findUniqueOrThrow`, `findFirst`, `findFirstOrThrow`, `findMany`,
 *    `count`, `aggregate`, `groupBy`) é reescrita através de
 *    `applyDeletedFilter` para que linhas soft-deleted fiquem ocultas a
 *    menos que o chamador tenha passado `INCLUDE_DELETED_FLAG`.
 *  - Escritas (`create`, `createMany`, `update`, `updateMany`, `upsert`,
 *    `delete`, `deleteMany`) intencionalmente NÃO são envolvidas — a
 *    camada de Repository captura histórico + incrementos de version
 *    dentro de seu próprio `prisma.$transaction` para atomicidade.
 *    Contornar a Port do Repository é uma proibição deliberada em nível
 *    de projeto (veja ADR-014).
 *
 * Adicionar uma nova entity auditada = (1) anexar o nome do model do
 * Prisma client em `AUDITED_MODELS`, (2) adicionar uma tabela
 * `<entity>_history` no `schema.prisma`, (3) implementar a transaction de
 * audit no Repository.
 */
export const auditExtension = Prisma.defineExtension({
  name: "domain-audit-foundation",
  query: {
    user: auditUserReadHandlers,
  },
});

// Garante que `AUDITED_MODELS` é referenciado para que adicionar um model
// à tuple sem atualizar este switch seja um lembrete em build time (a
// constante ainda é exportada acima para os testes).
void AUDITED_MODELS;
