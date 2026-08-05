# ddd-hexagonal Skill — Design Spec

**Date**: 2026-08-05
**Status**: Design approved (sections 1–4), pending user review of written spec
**Owner**: leo
**Project**: `ai-padrao`

---

## 1. Purpose

Create a **project-local Claude Code skill** (`/home/leo/Documentos/projetos/padrao/.claude/skills/ddd-hexagonal/`) that teaches an AI agent how to:

1. **Scaffold** a new bounded context under `apps/api/src/contexts/<ctx>/` following the project's DDD + Hexagonal layering.
2. **Audit** an existing bounded context against the layering rules, anti-patterns, and INC constraints accumulated in `.harness/INCIDENTS.md`.

The skill is **prescriptive** (audience: AI agent implementing), **bounded** (one focused outcome — DDD + Hexagonal applied to NestJS + Prisma in this repo), and **versioned with the repo** so it tracks any evolution of `apps/api/src/contexts/users/` (the canonical example).

It does **not** aim to teach DDD theory from scratch — the agent is expected to already know the vocabulary (Entity, Value Object, Aggregate, Repository, Use Case, Bounded Context). The skill's job is to translate that vocabulary into concrete file paths, ordering, contracts, and gates.

---

## 2. Architecture

### 2.1 Skill location

```
/home/leo/Documentos/projetos/padrao/.claude/skills/ddd-hexagonal/
├── SKILL.md                  # Main prescriptive guide (~250 lines)
├── CHECKLIST.md              # Validation gates for the agent
└── templates/
    ├── entity.ts.template
    ├── value-object.ts.template
    ├── aggregate.ts.template
    ├── repository-port.ts.template
    ├── repository-adapter.ts.template
    ├── mapper.ts.template
    ├── use-case.ts.template
    ├── in-memory-repository.ts.template
    ├── controller.ts.template
    ├── module.ts.template
    └── tests/
        ├── entity.spec.ts.template
        └── use-case.spec.ts.template
```

**Language convention:** SKILL.md e CHECKLIST.md são escritos em **PT-BR** (alinhado com AGENTS.md / INCIDENTS.md do projeto). Termos DDD canônicos em inglês (Entity, Aggregate, Value Object, Repository, Use Case) ficam em inglês; comentários em código ficam em inglês (padrão da indústria).

### 2.2 SKILL.md frontmatter

```yaml
---
name: ddd-hexagonal
description: Use when creating a new bounded context in apps/api/src/contexts/, scaffolding a NestJS feature module with DDD + Hexagonal structure, or auditing whether an existing context respects the project's domain/application/infrastructure layering. Triggers on "novo contexto", "bounded context", "scaffold feature", "criar aggregate", "domain entity", "use case", "reorganizar contexto", "auditar camadas", "DDD violation".
---
```

### 2.3 Canonical layering (4 camadas + module wiring)

```
apps/api/src/contexts/<ctx>/
├── <ctx>-context.module.ts                # NestJS wiring (registra providers + exporta)
├── <ctx>-context.tokens.ts                # DI tokens (Symbol) declarados aqui, NÃO no domain/
├── domain/                                # Camada 1 — pura
│   ├── entities/<entity>.ts + .spec.ts
│   ├── value-objects/<vo>.ts + .spec.ts
│   ├── errors/<error>.error.ts            # Erros de domínio (sem framework)
│   ├── events/<event>.ts                  # Eventos de domínio (opcional)
│   └── ports/<entity>-repository.port.ts  # Interface, não importa tokens
├── application/                           # Camada 2 — orquestração
│   ├── use-cases/<verb>-<entity>.use-case.ts + .spec.ts
│   └── testing/in-memory-<entity>-repository.ts
├── infrastructure/                        # Camada 3 — adapters
│   ├── persistence/prisma/
│   │   ├── prisma-<entity>.repository.ts + .spec.ts
│   │   └── <entity>.mapper.ts + .spec.ts
│   └── http/
│       ├── <entities>-http.controller.ts + .spec.ts
│       └── dto/<area>.dto.ts + .spec.ts   # DTOs Zod-derivados para o controller
```

**Regra cardinal de dependência:** setas apontam para dentro. `domain/` é puro (sem `@nestjs/*`, sem `@prisma/*`); `application/` depende de `domain/` e das `ports/`; `infrastructure/` implementa as `ports/` e conhece frameworks.

### 2.4 Sourcing strategy (híbrido)

Cada template em `templates/` é escrito sinteticamente (mínimo viável) mas cita o arquivo real correspondente em `apps/api/src/contexts/users/` como exemplo canônico vivo:

| Template sintético | Referência canônica em users/ |
|---|---|
| `entity.ts.template` | `apps/api/src/contexts/users/domain/entities/user.ts` |
| `value-object.ts.template` | `apps/api/src/contexts/users/domain/value-objects/email.ts` (ou `name.ts`, `user-role.ts`) |
| `aggregate.ts.template` | (sintético puro — users/ trata `User` como aggregate root sem pasta separada) |
| `repository-port.ts.template` | `apps/api/src/contexts/users/domain/ports/user-repository.port.ts` |
| `repository-adapter.ts.template` | `apps/api/src/contexts/users/infrastructure/persistence/prisma/prisma-user.repository.ts` |
| `mapper.ts.template` | `apps/api/src/contexts/users/infrastructure/persistence/prisma/user.mapper.ts` |
| `use-case.ts.template` | `apps/api/src/contexts/users/application/use-cases/find-user.use-case.ts` |
| `in-memory-repository.ts.template` | `apps/api/src/contexts/users/application/testing/in-memory-user.repository.ts` |
| `controller.ts.template` | `apps/api/src/contexts/users/infrastructure/http/users-http.controller.ts` |
| `module.ts.template` | `apps/api/src/contexts/users/users-context.module.ts` |
| `tokens.ts.template` | `apps/api/src/contexts/users/users-context.tokens.ts` |
| `tests/entity.spec.ts.template` | `apps/api/src/contexts/users/domain/entities/user.spec.ts` |
| `tests/use-case.spec.ts.template` | `apps/api/src/contexts/users/application/use-cases/find-user.use-case.spec.ts` |

**Vantagem do híbrido:** os templates sobrevivem a refatorações em `users/` (são abstratos) mas apontam para a referência real (são honestos quanto à verdade do projeto). Quando o agente vir divergência entre o template e a referência, deve tratar a referência como fonte de verdade.

---

## 3. Workflow de criação (8 steps prescritivos)

A skill dita a sequência exata. Do mais interno (domínio puro) para o mais externo (wiring):

### Step 1 — Descobrir o domínio (ubiquitous language)

- Ler `.openspec/changes/<feature>/proposal.md` se existir.
- Listar **substantivos** do domínio → candidatos a Entity.
- Listar **verbos** → candidatos a UseCase.
- Identificar **invariantes** → lógica que vive dentro da Entity ou de um Value Object (nunca no controller).
- **Output:** uma seção “Domínio identificado” no PR/commit message.

### Step 2 — Criar `domain/` (de dentro para fora)

1. **Value Objects** primeiro (ex: `Email`, `Money`) — blocos imutáveis, testáveis em isolamento.
2. **Entities/Aggregates** — só quando os VOs existem.
3. **Domain Events** (se aplicável) — `UserCreated`, `OrderPlaced`.
4. **Ports (interfaces)** — `UserRepositoryPort` é o contrato que `application/` consome via DI token (Symbol).
5. Cada arquivo vem com seu `*.spec.ts` (regra INC-012: zero skipped tests).

### Step 3 — Criar `application/`

1. **In-memory repository** (test double) — implementação rápida da port, usada nos testes de use case.
2. **Use Cases** — um arquivo por caso de uso (`CreateUserUseCase`, `FindUserUseCase`).
3. Cada use case tem `*.spec.ts` que consome o in-memory repo.

### Step 4 — Criar `infrastructure/persistence/prisma/`

1. Atualizar `apps/api/prisma/schema.prisma` com o modelo.
2. Rodar `pnpm db:migrate`.
3. **Mapper** (`prisma-<entity>.mapper.ts`) — converte `<Entity>` ↔ `<Entity>Record` do Prisma.
4. **Adapter** (`prisma-<entity>.repository.ts`) — implementa a port usando PrismaClient.
5. Testes do mapper (roundtrip puro) e do adapter (com DB de teste).

### Step 5 — Criar `infrastructure/http/`

1. **Controller** (`<entities>-http.controller.ts`) — recebe DTOs Zod, chama use cases via injeção de construtor, retorna response.
2. Testes e2e via Supertest + `Test.createTestingModule`.

### Step 6 — Criar o Module raiz

1. **Tokens primeiro** — `<ctx>-context.tokens.ts` declara um `Symbol` por port (`export const X_PORT = Symbol("XPort")`). Mantém o `domain/` puro (tokens ficam no contexto, não no domínio).
2. `<ctx>-context.module.ts` registra providers, importa adapters, exporta o que for consumido por outros módulos.
3. Importar o module em `apps/api/src/app.module.ts`.
4. Configurar o DI: `{ provide: X_PORT, useClass: PrismaXRepository }` — nunca usar a classe concreta como token; nunca usar string.

### Step 7 — Atualizar contracts

1. Adicionar Zod schemas em `packages/contracts/src/<area>.ts`.
2. Se houver DTOs HTTP, eles devem **reusar** os schemas Zod do contracts (não duplicar).
3. Atualizar `packages/contracts/src/<area>.spec.ts` (regra INC-012).

### Step 8 — Self-check com CHECKLIST.md

Antes de declarar a feature pronta, o agente deve rodar mentalmente cada item do [CHECKLIST.md](../superpowers/skills/ddd-hexagonal/CHECKLIST.md) (resumo na §4.2).

---

## 4. Anti-patterns e CHECKLIST

### 4.1 Anti-patterns (a skill ensina o agente a evitar)

| # | Anti-pattern | Por que é proibido | Como detectar |
|---|--------------|---------------------|---------------|
| 1 | `domain/entities/foo.ts` importando `@nestjs/common` | Quebra inversão de dependência — domain vira refém do framework | `grep -r "@nestjs" apps/api/src/contexts/*/domain/` deve ser vazio |
| 2 | `domain/entities/foo.ts` importando `@prisma/client` | Idem — domain não conhece DB | `grep -r "@prisma" apps/api/src/contexts/*/domain/` deve ser vazio |
| 3 | `import type` em arquivo de DI NestJS | Apaga metadata do decorator → DI quebra (INC-003) | Lint rule + INC-024 (futuro) |
| 4 | Use case chamando `prisma.user.findMany()` direto | Bypassa a port — use case deixa de ser testável sem DB | `grep -r "prisma\." apps/api/src/contexts/*/application/` deve ser vazio |
| 5 | Controller com lógica de negócio | Camada de apresentação vira god object | Code review |
| 6 | Domain Event emitido pelo Adapter (Prisma) | Acoplamento — domain events devem ser disparados pelo aggregate | Code review; verificar que `emit()` é chamado dentro de método da entity |
| 7 | Aggregate que muta estado via setter cru (`user.name = x`) | Vaza invariantes — use case passa a controlar regras | Preferir `user.rename(newName)` em vez de `user.name = newName` |
| 8 | DTO HTTP duplicando schema Zod do `packages/contracts/` | Drift entre cliente e servidor | Reusar `z.infer` do contracts |
| 9 | Teste `.skip`, `.todo`, `--passWithNoTests` | Cobertura falsa (INC-012) | `.harness/check.sh` já detecta |

### 4.2 CHECKLIST.md (resumo, 6 seções)

```markdown
## Bounded Context Self-Check

### Domain purity
- [ ] `domain/` não importa `@nestjs/*` (grep)
- [ ] `domain/` não importa `@prisma/*` (grep)
- [ ] Toda entity tem invariantes validadas no construtor (sem setters crus)

### Application layer
- [ ] Cada use case tem `*.spec.ts` (find count match)
- [ ] Use cases recebem port via construtor (não `new PrismaUserRepository()` direto)
- [ ] `application/` não tem `import` de `@prisma/client`

### Infrastructure
- [ ] Mapper (`*.mapper.ts`) existe para cada entity persistida
- [ ] Adapter (`prisma-*.repository.ts`) implementa a port declarada em `domain/ports/`
- [ ] `*.spec.ts` para mapper e adapter

### HTTP layer
- [ ] Controller usa `@Body() dto: X` com Zod schema de `packages/contracts/src/`
- [ ] Não há DTO duplicado — reusa Zod do contracts
- [ ] `@Public()` aplicado em endpoints que não precisam de auth

### Module wiring
- [ ] `<ctx>-context.module.ts` registrado em `apps/api/src/app.module.ts`
- [ ] DI token para cada port: **preferir `Symbol` declarado em `domain/ports/`** (não string, não classe concreta) — ver users/ para o padrão atual
- [ ] `import type` proibido em qualquer arquivo de DI (INC-003)

### Tests
- [ ] Zero `.skip` / `.todo` / `--passWithNoTests` (INC-012)
- [ ] e2e em `test/<ctx>.e2e-spec.ts` exercita ao menos 1 happy path + 1 erro
```

### 4.3 Testing matrix

| Camada | Tipo de teste | Ferramenta | Mínimo |
|---|---|---|---|
| `domain/` | Unit (puro, sem Nest) | Vitest | Cobertura de cada invariante + cada método público da entity |
| `application/` | Unit com in-memory repo | Vitest | Cada use case: happy path + cada erro mapeado |
| `infrastructure/persistence/` | Integration com Postgres real | Vitest + `@ai-padrao/db` | Roundtrip Prisma → mapper → domain → mapper → Prisma |
| `infrastructure/http/` | E2e (Nest Test.createTestingModule + Supertest) | Vitest + Supertest | Cada rota: 2xx + 4xx + auth (quando aplicável) |

---

## 5. Out of scope

A skill **não** cobre:

- Teoria DDD em profundidade (o agente já sabe o vocabulário).
- Outras arquiteturas além de Hexagonal (Clean Architecture, Onion, etc.).
- Frameworks diferentes de NestJS + Prisma.
- CQRS / Event Sourcing (considerar ADR futura se algum contexto exigir).
- i18n do conteúdo da skill (escrita em PT-BR, com termos DDD em EN quando canônico).
- Refatoração de contextos existentes — a skill é para **criar** e **auditar**, não para migrar.
- Atualização da entrada INC-024 (separada por decisão do usuário em 2026-08-05).

---

## 6. Decisions / trade-offs

1. **Localização projeto-local em vez de global** — acoplada ao ai-padrao, mas versionada e descoberta por qualquer agente no repo. Aceitável porque a skill é 80% específica deste projeto.
2. **Híbrido (templates sintéticos + referência real)** — duplica trabalho de manutenção se `users/` mudar muito, mas mantém os templates estáveis. Referência viva na seção "Sourcing strategy".
3. **CHECKLIST.md separado do SKILL.md** — facilita execução pelo agente (pode ser invocado como lista de tarefas isolada). Custo: pequeno arquivo extra.
4. **Sem seção de "audit"** — auditoria cai naturalmente sobre a aplicação do CHECKLIST.md, sem necessidade de arquivo dedicado. Decidido após considerar AUDITOR.md separado.
5. **Apenas 2 templates de teste (entity.spec.ts.template e use-case.spec.ts.template)** — controller e adapter têm padrões muito dependentes do schema Prisma + Zod de cada contexto; templates abstratos ficariam desatualizados rápido.

---

## 7. Verification plan

Quando a skill estiver escrita, o teste mínimo de aceitação (TDD aplicado a skill):

1. Pegar uma feature real do ai-padrao já fechada (ex: `users/`).
2. Apagar `apps/api/src/contexts/users/` (em worktree isolado).
3. Pedir ao agente para recriar o contexto **usando apenas a skill** como referência.
4. Verificar:
   - Estrutura de pastas bate com §2.3.
   - Domain purity (anti-pattern #1 e #2): zero imports proibidos.
   - Cada use case tem spec (anti-pattern #9: zero skipped tests).
   - Mapper e adapter existem e testam roundtrip.
   - Module registrado em `app.module.ts`.
5. Comparar diff: similaridade semântica aceitável, similaridade literal não exigida.

Se o passo 4 falhar, ajustar a skill. Repetir até passar.

---

## 8. References

- `apps/api/src/contexts/users/` — canonical example (live in repo).
- `.harness/INCIDENTS.md` INC-003 (`import type`) — anti-pattern #3 e module wiring check.
- `.harness/INCIDENTS.md` INC-012 (no skipped tests) — anti-pattern #9 e tests check.
- `.harness/INCIDENTS.md` INC-024 (legitimate `import type` for types/interfaces) — diagnostic gap acknowledged but not yet scheduled.
- `.harness/INCIDENTS.md` Pattern: Alura's "guias + sensores" — princípio que justifica criar a skill como feedforward para um sensor ausente.
- `AGENTS.md` — regra mestra do projeto, em particular a seção sobre SDD (a skill respeita esse fluxo).
- `docs/decisions/ADR-014` (domain-audit-foundation) — change em andamento que motivou esta skill.

---

## 9. Changelog

- **2026-08-05** — Initial design created via brainstorming (4 sections, all approved). Pending: write skill + run TDD verification (§7).