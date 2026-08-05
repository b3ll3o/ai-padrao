/**
 * Audit layer types shared by the audit-extension and downstream callers.
 *
 * Per ADR-014, every entry in `AUDITED_MODELS` becomes a domain entity that
 * gains: `deletedAt`, `version`, and a typed `<entity>_history` table.
 */

export type AuditOp = "CREATE" | "UPDATE" | "DELETE" | "RESTORE";

/**
 * Tuple of model names (lower-cased Prisma client property names) that the
 * audit extension is allowed to instrument. Models not in this tuple are
 * untouched by the extension. Adding a new domain entity = appending its name
 * here AND adding a `<entity>_history` table to `schema.prisma`.
 */
export const AUDITED_MODELS = ["user"] as const;
export type AuditedModel = (typeof AUDITED_MODELS)[number];

export interface AuditContext {
  actorId?: string | undefined;
}

/**
 * Shape of a single history entry written to a `<entity>_history` table.
 * The `snapshot` is the JSON-serialized row state captured BEFORE the
 * mutation that produced this entry.
 */
export interface HistorySnapshot {
  id: string;
  [key: string]: unknown;
}
