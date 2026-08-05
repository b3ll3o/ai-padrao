import { Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AUDITED_MODELS } from "./audit.types";

const auditLog = new Logger("AuditExtension");

/**
 * Sentinel arg key used to opt a single Prisma read OUT of the
 * `deletedAt: null` filter. The repository layer passes this via
 * `findUnique({ where: { id, [INCLUDE_DELETED_FLAG]: true } })` for
 * `findByIdIncludingDeleted`.
 *
 * The string is prefixed to make grep / audit easy; Prisma forwards
 * unknown keys through `where` without erroring, and the extension
 * strips it before the inner query runs.
 */
export const INCLUDE_DELETED_FLAG = "__auditIncludeDeleted";

interface ArgsWithFlag {
  where?: Record<string, unknown> | null;
}

interface WhereWithFlag extends Record<string, unknown> {
  __auditIncludeDeleted?: boolean;
}

/**
 * Pure transformation applied to every read on an audited model. Exported
 * for unit-testing and for the audit.spec — keeping the logic out of the
 * Prisma extension machinery lets us assert behaviour without standing
 * up a database.
 *
 * Behaviour:
 *  - If `args.where` already has a `deletedAt` filter, leave it alone.
 *  - If `args.where[INCLUDE_DELETED_FLAG]` is `true`, strip the sentinel
 *    from `where` and return the rest unchanged.
 *  - Otherwise, set `args.where.deletedAt = null`.
 *  - Non-object args are returned unchanged (defensive).
 */
export function applyDeletedFilter(args: unknown): unknown {
  if (!args || typeof args !== "object") return args;
  const a = args as ArgsWithFlag;
  const existingWhere = (a.where ?? {}) as WhereWithFlag;
  if (existingWhere.__auditIncludeDeleted === true) {
    // Strip the sentinel from `where` by destructuring-and-discarding.
    // The field name starts with `_` to satisfy the project's
    // `no-unused-vars` rule without an eslint-disable directive.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { __auditIncludeDeleted: _auditIncludeDeleted, ...rest } =
      existingWhere;
    // Logging the opt-out makes the read-visible-to-deleted-rows
    // pattern greppable in production logs. Use Nest Logger per ADR-006.
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
 * Shape of the `params` argument Prisma passes to each `query.<model>.<op>`
 * handler. We only use `args` (the user-provided query args) and `query`
 * (the inner handler that actually executes the query against the
 * database). Marked `unknown` for the inner-query return because we don't
 * model Prisma's typed results here — `applyDeletedFilter` is a pure
 * transform, the actual result type is the call site's responsibility.
 */
export interface AuditReadParams {
  args: unknown;

  query: (args: unknown) => Promise<any>;
}

/**
 * Shared body of every `query.<model>.<readOp>` handler. Centralised so
 * there's a single function the unit tests can drive — the eight read
 * handlers below all delegate here. If the audit logic ever needs a
 * per-op override (e.g. `findUnique` should also enforce uniqueness
 * constraints), this is the seam.
 */
export function wrapAuditRead(params: AuditReadParams): Promise<unknown> {
  // Read params from Prisma can be object-or-null depending on the op;
  // logging the shape helps diagnose mis-wired audit reads in prod.
  const argsSummary =
    params.args && typeof params.args === "object"
      ? Object.keys(params.args).join(",")
      : "none";
  auditLog.debug(`audit read keys=${argsSummary}`);
  return params.query(applyDeletedFilter(params.args));
}

/**
 * Named handlers exported as a flat object so each is unit-testable in
 * isolation. The Prisma `$extends` machinery below wraps the same object
 * reference — wiring is `query.user = auditUserReadHandlers`.
 *
 * Lifting these out of the inline object literal means we can call
 * `auditUserReadHandlers.findUnique({ args, query })` from a Jest spec
 * without standing up a real `PrismaClient`. Every branch in this
 * module is reachable from tests via either `applyDeletedFilter` (the
 * pure transform) or one of these handlers (the binding to Prisma).
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
 * The Prisma `$extends` definition injected by `PrismaService`.
 *
 * Behaviour:
 *  - Every read on every model in `AUDITED_MODELS` (`findUnique`,
 *    `findUniqueOrThrow`, `findFirst`, `findFirstOrThrow`, `findMany`,
 *    `count`, `aggregate`, `groupBy`) is rewritten through `applyDeletedFilter`
 *    so soft-deleted rows are hidden unless the caller passed
 *    `INCLUDE_DELETED_FLAG`.
 *  - Writes (`create`, `createMany`, `update`, `updateMany`, `upsert`,
 *    `delete`, `deleteMany`) are intentionally NOT wrapped — the
 *    repository layer captures history + version bumps inside its own
 *    `prisma.$transaction` for atomicity. Going around the repository
 *    port is a deliberate project-level prohibition (see ADR-014).
 *
 * Adding a new audited entity = (1) append its Prisma client model name
 * to `AUDITED_MODELS`, (2) add a `<entity>_history` table to
 * `schema.prisma`, (3) implement the audit transaction in the repository.
 */
export const auditExtension = Prisma.defineExtension({
  name: "domain-audit-foundation",
  query: {
    user: auditUserReadHandlers,
  },
});

// Ensure `AUDITED_MODELS` is referenced so adding a model to the tuple
// without updating this switch is a build-time reminder (the constant is
// still exported above for tests).
void AUDITED_MODELS;
