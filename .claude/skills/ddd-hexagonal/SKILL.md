---
name: ddd-hexagonal
description: Use when creating a new bounded context in apps/api/src/contexts/, scaffolding a NestJS feature module with DDD + Hexagonal structure, or auditing whether an existing context respects the project's domain/application/infrastructure layering. Triggers on "novo contexto", "bounded context", "scaffold feature", "criar aggregate", "domain entity", "use case", "reorganizar contexto", "auditar camadas", "DDD violation".
---

# Skill: ddd-hexagonal

Skill **prescritiva** para criar e auditar bounded contexts em `apps/api/src/contexts/` do projeto `ai-padrao`. Assume que você (agente) já conhece o vocabulário DDD — esta skill traduz a teoria em arquivos, ordem de criação e contratos concretos.

**Quando usar:**
- "Criar novo bounded context para `<feature>`"
- "Scaffold de um novo módulo NestJS"
- "Auditar se `apps/api/src/contexts/<ctx>/` respeita as camadas"
- "Refatorar contexto existente para o padrão DDD + Hexagonal"

**Quando NÃO usar:**
- Criar algo fora de `apps/api/src/contexts/` (lógica em `apps/web/`, scripts, libs)
- Tarefas puramente de bugfix que não tocam na estrutura de camadas

**Convenção de idioma:** este documento é PT-BR. Termos DDD canônicos (Entity, Aggregate, Value Object, Repository, Use Case) ficam em inglês. Comentários em código também em inglês (padrão da indústria).

---

## 1. As 4 camadas (regra de dependência)

Setas de dependência apontam **para dentro**:

```
┌─────────────────────────────────────────────────────────────┐
│  infrastructure/  ──────────────┐                          │
│  • persistence/prisma/           │                          │
│  • http/                         ▼                          │
│  • (qualquer adapter concreto)  application/               │
│                                  • use-cases/               │
│                                  • testing/                 │
│                                  │                          │
│                                  ▼                          │
│                                 domain/                     │
│                                  • entities/                │
│                                  • value-objects/           │
│                                  • errors/                  │
│                                  • events/                  │
│                                  • ports/                   │
└─────────────────────────────────────────────────────────────┘
```

**Regra absoluta:** `domain/` NÃO importa `@nestjs/*`, `@prisma/*`, nem qualquer framework. Se aparecer, é bug.

---

## 2. Estrutura de pastas

Toda context nova segue este layout (use `templates/module.ts.template` como ponto de partida):

```
apps/api/src/contexts/<ctx>/
├── <ctx>-context.module.ts                # NestJS wiring
├── <ctx>-context.tokens.ts                # DI tokens (Symbol)
├── domain/
│   ├── entities/<entity>.ts + .spec.ts
│   ├── value-objects/<vo>.ts + .spec.ts
│   ├── errors/<error>.error.ts
│   ├── events/<event>.ts                  # opcional
│   └── ports/<entity>-repository.port.ts
├── application/
│   ├── use-cases/<verb>-<entity>.use-case.ts + .spec.ts
│   └── testing/in-memory-<entity>-repository.ts
└── infrastructure/
    ├── persistence/prisma/
    │   ├── prisma-<entity>.repository.ts + .spec.ts
    │   └── <entity>.mapper.ts + .spec.ts
    └── http/
        ├── <entities>-http.controller.ts + .spec.ts
        └── dto/<area>.dto.ts + .spec.ts
```

**Convenção de nomes:**
- Entities: PascalCase singular (`User`, `Order`, `Invoice`)
- Value Objects: PascalCase (`Email`, `Money`, `Cpf`)
- Use Cases: `<Verbo><Entidade>UseCase` (`CreateUserUseCase`, `FindUserUseCase`)
- Ports: `<entidade>RepositoryPort` (interface)
- Adapters Prisma: `Prisma<Entidade>Repository`
- Errors: `<entidade><situacao>Error` (`UserNotFoundError`)
- DI tokens: `<ENTIDADE>_PORT` (constante exportada de `<ctx>-context.tokens.ts`)

**Convenção de placeholders nos templates:**
- `<ctx>` é a forma kebab-case do nome da pasta do contexto (ex.: `users`, `billing`).
- `<CTX>` é a forma UPPER_SNAKE_CASE do mesmo nome (ex.: `USERS`, `BILLING`), usada em DI tokens (`<CTX>_EVENT_BUS_PORT`).
- `<Entities>` assume plural regular `+s` (User→Users). Plurais irregulares (Person→People, Child→Children) exigem edição manual após copiar o template.

---

## 3. Workflow de criação (ordem obrigatória)

Crie os arquivos **de dentro para fora**: primeiro `domain/`, depois `application/`, depois `infrastructure/`, por último o wiring.

### Step 1 — Descobrir o domínio (ubiquitous language)

Antes de escrever uma linha de código:

1. Ler `.openspec/changes/<feature>/proposal.md` se existir.
2. Listar **substantivos** do domínio → candidatos a Entity/Value Object.
3. Listar **verbos** do domínio → candidatos a Use Case.
4. Identificar **invariantes** → lógica que vive dentro da Entity ou de um VO (nunca no controller).
5. Documentar em uma seção "Domínio identificado" no PR/commit message.

### Step 2 — Criar `domain/` (de dentro para fora)

1. **Value Objects primeiro** — `Email`, `Money`, `Cpf`. Blocos imutáveis, testáveis em isolamento.
2. **Entities** — só quando os VOs que ela usa existem.
3. **Domain Errors** — erros específicos do domínio (`UserNotFoundError`).
4. **Domain Events** (opcional) — `UserCreated`, `OrderPlaced`.
5. **Ports** — interface vazia, sem implementação.
6. Cada arquivo vem com `*.spec.ts` (regra INC-012: zero skipped tests).

Use `templates/entity.ts.template`, `templates/value-object.ts.template`, `templates/repository-port.ts.template`.

### Step 3 — Criar `application/`

1. **In-memory repository** (test double) — implementação da port, usada pelos testes de use case.
2. **Use Cases** — um arquivo por caso de uso.
3. Cada use case tem `*.spec.ts` que consome o in-memory repo.

Use `templates/use-case.ts.template`, `templates/in-memory-repository.ts.template`, `templates/tests/use-case.spec.ts.template`.

### Step 4 — Criar `infrastructure/persistence/prisma/`

1. Atualizar `apps/api/prisma/schema.prisma` com o modelo.
2. Rodar `pnpm db:migrate`.
3. **Mapper** — converte `<Entity>` ↔ `<Entity>Record` do Prisma.
4. **Adapter** — implementa a port usando `PrismaClient`.
5. Testes do mapper (roundtrip puro) e do adapter (com DB de teste).

Use `templates/repository-adapter.ts.template`, `templates/mapper.ts.template`.

### Step 5 — Criar `infrastructure/http/`

1. **DTO** (`dto/<area>.dto.ts`) — Zod schemas reusados de `packages/contracts/src/`.
2. **Controller** — recebe DTOs Zod via `@Body()`, chama use cases via construtor, retorna response.
3. Testes e2e via Supertest + `Test.createTestingModule`.

Use `templates/controller.ts.template`.

### Step 6 — Criar o Module raiz

1. **Tokens primeiro** — `<ctx>-context.tokens.ts` declara um `Symbol` por port.
2. **Module** — `<ctx>-context.module.ts` registra providers, importa adapters.
3. **DI binding** — `{ provide: X_PORT, useClass: PrismaXRepository }`.
4. Importar o module em `apps/api/src/app.module.ts`.

Use `templates/module.ts.template`, `templates/tokens.ts.template`.

### Step 7 — Atualizar contracts (se necessário)

1. Adicionar Zod schemas em `packages/contracts/src/<area>.ts`.
2. DTOs HTTP devem **reusar** os schemas Zod do contracts (não duplicar).
3. Atualizar `packages/contracts/src/<area>.spec.ts`.

### Step 8 — Self-check

Antes de declarar a feature pronta, rodar mentalmente cada item de [CHECKLIST.md](./CHECKLIST.md). Se qualquer item falhar, corrigir antes de pedir review.

---

## 4. Anti-patterns (proibidos)

| # | Anti-pattern | Por que é proibido |
|---|--------------|---------------------|
| 1 | `domain/*.ts` importando `@nestjs/common` | Quebra inversão de dependência — domain vira refém do framework |
| 2 | `domain/*.ts` importando `@prisma/client` | Domain não conhece DB |
| 3 | `import type` em arquivo de DI NestJS | Apaga metadata do decorator → DI quebra (INC-003) |
| 4 | Use case chamando `prisma.user.findMany()` direto | Bypassa a port — use case deixa de ser testável sem DB |
| 5 | Controller com lógica de negócio | Camada de apresentação vira god object |
| 6 | Domain Event emitido pelo Adapter (Prisma) | Acoplamento — domain events devem sair do aggregate |
| 7 | Setter cru em entity (`user.name = x`) | Vaza invariantes — use case passa a controlar regras |
| 8 | DTO HTTP duplicando schema Zod do `packages/contracts/` | Drift entre cliente e servidor |
| 9 | Teste `.skip`, `.todo`, `--passWithNoTests` | Cobertura falsa (INC-012) |
| 10 | Token DI como string ou classe concreta | Força acoplamento — usar `Symbol` em `<ctx>-context.tokens.ts` |

**Detecção automática** (rodar antes de pedir review):

```bash
# Anti-pattern 1 e 2 — domain purity
grep -rn "@nestjs\|@prisma" apps/api/src/contexts/<ctx>/domain/

# Anti-pattern 4 — application não acessa Prisma
grep -rn "prisma\." apps/api/src/contexts/<ctx>/application/

# Anti-pattern 9 — skipped tests
grep -rn "\.skip\|\.todo\|passWithNoTests" apps/api/src/contexts/<ctx>/
```

---

## 5. Testing

| Camada | Tipo | Ferramenta | Mínimo |
|---|---|---|---|
| `domain/` | Unit puro | Vitest | Cobertura de cada invariante + cada método público |
| `application/` | Unit com in-memory repo | Vitest | Cada use case: happy + cada erro mapeado |
| `infrastructure/persistence/` | Integration com Postgres | Vitest + `@ai-padrao/db` | Roundtrip Prisma → mapper → domain → mapper → Prisma |
| `infrastructure/http/` | E2e (Nest + Supertest) | Vitest + Supertest | Cada rota: 2xx + 4xx + auth (quando aplicável) |

**Regra absoluta:** zero `.skip` / `.todo` / `--passWithNoTests` (regra INC-012).

---

## 6. Referências vivas em `apps/api/src/contexts/users/`

Quando em dúvida, copie do `users/` (a fonte de verdade viva do projeto):

| Peça | Arquivo |
|---|---|
| Entity | `domain/entities/user.ts` |
| Value Object | `domain/value-objects/email.ts` |
| Port | `domain/ports/user-repository.port.ts` |
| Mapper | `infrastructure/persistence/prisma/user.mapper.ts` |
| Adapter | `infrastructure/persistence/prisma/prisma-user.repository.ts` |
| Use Case | `application/use-cases/find-user.use-case.ts` |
| In-memory repo | `application/testing/in-memory-user.repository.ts` |
| Controller | `infrastructure/http/users-http.controller.ts` |
| DTO | `infrastructure/http/dto/users.dto.ts` |
| Tokens | `users-context.tokens.ts` |
| Module | `users-context.module.ts` |

**Quando divergência entre template e referência:** a referência em `users/` é a verdade. Reportar ao humano para atualizar o template.
