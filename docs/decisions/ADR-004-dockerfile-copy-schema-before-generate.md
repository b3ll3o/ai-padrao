# ADR-004 — Dockerfile: copiar o schema do Prisma ANTES de `prisma generate`

- **Status:** Aceito
- **Date:** 2026-08-04

## Contexto

`prisma generate` lê `apps/api/prisma/schema.prisma` a partir do
contexto de build. Se a linha `COPY apps/api ./apps/api` vier
DEPOIS da linha `RUN pnpm --filter … exec prisma generate`, o schema
não está na imagem no momento do generate. O erro é alto em rebuild
limpo: "Could not find Prisma Schema that is required for this
command" — mas frequentemente passa despercebido porque CI faz cache
das camadas de um build anterior bem-sucedido, e o container sobe
tranquilo.

## Decisão

O Dockerfile de qualquer serviço que rode `prisma generate` durante o
build DEVE colocar o schema no contexto de build ANTES do passo de
generate. A forma canônica:

```dockerfile
COPY apps/api/prisma ./apps/api/prisma # schema primeiro
RUN pnpm --filter @ai-padrao/api exec prisma generate
COPY apps/api ./apps/api # resto do app
```

Para Dockerfiles novos, siga esta ordem exata. Para os existentes, o
auto-check abaixo vai flagar o bug.

## Consequências

- **Mais fácil:** Builds com cache frio funcionam; rebuilds de imagem
  a partir de estado limpo dão certo.
- **Mais difícil:** Camada intermediária levemente maior (a cópia do
  schema adiciona ~10 KB). Insignificante.
- **Trade-off:** Aceitar — correção de custo zero para um build-
  breaker.

## Enforcement

- Skill: `pnpm-monorepo-script-pitfalls` Pitfall 4.
