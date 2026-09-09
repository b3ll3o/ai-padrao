# Spec: API — Domain Audit Foundation

Esta spec descreve o comportamento da fundação de auditoria depois que a
mudança for implementada.

## Requisitos

As palavras-chave **SHALL**, **SHOULD** e **MAY** seguem a RFC 2119.

### Forma da entidade de domínio

- WHEN uma entidade de domínio é armazenada no banco, THE system SHALL persistir
  `id`, `createdAt`, `updatedAt`, `deletedAt` (nullable) e `version`.
- WHEN uma entidade de domínio é criada, THE system SHALL definir `version`
  como `0`, `deletedAt` como `null` e escrever um registro de histórico `CREATE`.
- WHEN uma entidade de domínio é atualizada, THE system SHALL atomicamente
  (em uma única transação) incrementar `version` em `1`, definir `updatedAt`
  para o tempo atual e escrever um registro de histórico cujo `snapshot` é o
  estado anterior da linha.
- WHEN uma entidade de domínio é deletada via aplicação, THE system SHALL
  definir `deletedAt` como o tempo atual, incrementar `version` em `1` e
  escrever um registro de histórico `DELETE`. THE system SHALL NOT remover
  fisicamente a linha.
- WHEN uma entidade soft-deleted é restaurada, THE system SHALL definir
  `deletedAt` como `null`, incrementar `version` em `1` e escrever um registro
  de histórico `RESTORE`.

### Semântica de leitura

- WHEN a aplicação lê uma entidade de domínio por id, THE system SHALL
  retornar `null` (ou um 404 via HTTP) quando a linha está soft-deleted.
- WHEN a aplicação lista entidades de domínio, THE system SHALL excluir as
  linhas soft-deleted do resultado.
- THE system SHALL expor um método de port explícito
  `findByIdIncludingDeleted(id)` que retorna linhas soft-deleted para caminhos
  admin/restore.

### HTTP API

- WHEN `DELETE /api/users/:id` é chamado por um usuário autenticado, THE
  system SHALL soft-deletar o usuário e retornar `204`.
- WHEN `PATCH /api/users/:id/restore` é chamado por um admin, THE system
  SHALL restaurar um usuário soft-deleted e retornar `200` com o DTO do
  usuário. THE system SHALL retornar `404` se nenhum usuário com esse id
  existir (independentemente do estado de deleção). THE system SHALL retornar
  `409` se o usuário não estiver atualmente soft-deleted.
- WHEN `GET /api/users/:id/history` é chamado por um admin, THE system SHALL
  retornar `200` com `{ entries: UserHistoryEntry[] }` ordenado por `version`
  ascendente. THE system SHALL retornar `404` se nenhum usuário com esse id
  existir.

### Cobertura e qualidade

- THE system SHALL manter a cobertura de `apps/api` em ≥ 80% em todas as
  métricas (statements, branches, functions, lines).
- THE system SHALL NOT introduzir testes pulados ou `.todo` em arquivos
  versionados.

## Exemplos

### Lifecycle

```
POST /api/users (admin) → 201, body { id: "u1", ..., version: 0 }
PATCH /api/users/u1 { name: "Alice2" } → 200, body { id: "u1", ..., version: 1 }
PATCH /api/users/u1 { name: "Alice3" } → 200, body { id: "u1", ..., version: 2 }
DELETE /api/users/u1 → 204
GET /api/users/u1 → 404
GET /api/users/u1/history → 200, body { entries: [
  { version: 0, operation: "CREATE",  changedAt: "...", snapshot: { id: "u1", name: "Alice",  ... } },
  { version: 1, operation: "UPDATE",  changedAt: "...", snapshot: { id: "u1", name: "Alice2", ... } },
  { version: 2, operation: "UPDATE",  changedAt: "...", snapshot: { id: "u1", name: "Alice3", ... } },
  { version: 3, operation: "DELETE",  changedAt: "...", snapshot: { id: "u1", name: "Alice3", deletedAt: "...", ... } },
] }
PATCH /api/users/u1/restore → 200, body { id: "u1", ..., version: 4 }
GET /api/users/u1 → 200, body { id: "u1", ..., version: 4 }
```

### Erro

```
PATCH /api/users/u1/restore   (quando u1 não está soft-deleted) → 409
{ "statusCode": 409, "message": "User is not deleted", "path": "/api/users/u1/restore" }
```
