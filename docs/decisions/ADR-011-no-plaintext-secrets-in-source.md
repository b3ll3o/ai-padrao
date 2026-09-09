# ADR-011 — Sem tokens em texto puro no source versionado

- **Status:** Aceito
- **Date:** 2026-08-04

## Contexto

Chaves reais de API vazaram em um rewrite versionado de
`.env.example` durante a onda de estabilização do `ai-padrao`. O
padrão parecia um valor de exemplo (`sk-ant-api03-EXAMPLE…`) e
sobreviveu ao code review; o vazamento real veio de um copy-paste de
um `.env` de outro projeto. Uma vez no histórico git, rotação de
secret é a única remediação — `git filter-branch` não é seguro para
repositórios compartilhados.

Detecção heurística cobre os formatos bem-conhecidos (Anthropic,
GitHub PAT, OpenAI, AWS access-key) sem risco de falso-positivo em
strings comuns. A detecção roda em build time, antes do push, então
o vazamento nunca chega em `origin`.

## Decisão

Source versionado sob `apps/` e `packages/` NÃO PODE conter tokens
hardcoded com o formato de:

- `sk-ant-…`, `sk-cp-…` (Anthropic)
- `ghp_…`, `github_pat_…` (GitHub)
- `sk-…` de comprimento ≥ 32 (OpenAI)
- `AKIA…` de comprimento 20 (AWS access key id)

Fixtures de teste (`*.spec.ts`, `*.test.ts`, `*.mock.ts`,
`*.fixture.ts`) são excluídas por caminho; env files (`.env`,
`.env.example`) são excluídos via `.gitignore` e nunca escaneados.

Secrets pertencem ao `.env` (gitignored) ou a um secret store de
runtime. DEVEM ser referenciados via `process.env.NAME` ou um typed
config loader, nunca interpolados no source.

## Consequências

- **Mais fácil:** Vazamentos comuns de secret falham o build em vez
  do post-mortem. A checagem é rápida (um único `grep -rE`).
- **Mais difícil:** Um novo formato de token exige atualizar a lista
  de regex antes que o novo formato possa ser commitado.
- **Trade-off:** Aceitar — custo de rotação de secret é vastamente
  maior que o custo de manutenção da lista de regex.

## Enforcement

- `REGRAS.md §Sem secrets em texto puro` é a regra human-facing.
- Um follow-up documentado (ainda não um INC): expandir a detecção
  para os formatos do Stripe (`sk_live_…`, `rk_live_…`) e SendGrid
  (`SG.…`).
