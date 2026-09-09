import { AsyncLocalStorage } from "node:async_hooks";
import type { AuditContext } from "./audit.types";

/**
 * Carrega metadados de audit por request (atualmente o user id do actor)
 * através das fronteiras assíncronas, para que a extension de audit
 * consiga atribuir as escritas sem passar `actorId` por todos os call
 * sites do Prisma.
 *
 * Definida via `auditContext.run({ actorId }, async () => { ... })` a
 * partir da camada HTTP (ex.: uma vez por request, após a verificação
 * do JWT).
 */
export const auditContext = new AsyncLocalStorage<AuditContext>();
