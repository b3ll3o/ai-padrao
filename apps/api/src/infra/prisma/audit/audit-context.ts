import { AsyncLocalStorage } from "node:async_hooks";
import type { AuditContext } from "./audit.types";

/**
 * Carries per-request audit metadata (currently the actor's user id) across
 * async boundaries so the audit extension can attribute writes without
 * threading `actorId` through every Prisma call site.
 *
 * Set via `auditContext.run({ actorId }, async () => { ... })` from the HTTP
 * layer (e.g. once per request, after JWT verification).
 */
export const auditContext = new AsyncLocalStorage<AuditContext>();
