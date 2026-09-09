/**
 * Tipos da camada de audit compartilhados pela audit-extension e pelos
 * chamadores downstream.
 *
 * Conforme ADR-014, cada entrada em `AUDITED_MODELS` se torna uma entity
 * de domínio que ganha: `deletedAt`, `version` e uma tabela
 * `<entity>_history` tipada.
 */

export type AuditOp = "CREATE" | "UPDATE" | "DELETE" | "RESTORE";

/**
 * Tuple de nomes de models (nomes de propriedades em minúsculas no Prisma
 * client) que a extension de audit pode instrumentar. Models que não estão
 * nesta tuple não são tocados pela extension. Adicionar uma nova entity de
 * domínio = anexar seu nome aqui E adicionar uma tabela `<entity>_history`
 * no `schema.prisma`.
 */
export const AUDITED_MODELS = ["user"] as const;
export type AuditedModel = (typeof AUDITED_MODELS)[number];

export interface AuditContext {
  actorId?: string | undefined;
}

/**
 * Shape de uma única entrada de histórico escrita em uma tabela
 * `<entity>_history`. O `snapshot` é o estado da linha serializado em
 * JSON capturado ANTES da mutação que produziu esta entrada.
 */
export interface HistorySnapshot {
  id: string;
  [key: string]: unknown;
}
