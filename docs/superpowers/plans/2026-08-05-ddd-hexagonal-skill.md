# ddd-hexagonal Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a project-local Claude Code skill (`/home/leo/Documentos/projetos/padrao/.claude/skills/ddd-hexagonal/`) that prescribes how to scaffold and audit a NestJS bounded context following the project's DDD + Hexagonal layering, with synthetic templates that point to `apps/api/src/contexts/users/` as the canonical live example.

**Architecture:** One `SKILL.md` (~250 lines, PT-BR with English DDD terms) + one `CHECKLIST.md` (validation gates) + 12 synthetic `.template` files under `templates/` and `templates/tests/` (referencing real users/ files in a header comment). All in PT-BR except code identifiers.

**Tech Stack:** Markdown for prose, TypeScript snippets inside `.template` files, Bash `grep`/`find` snippets inside CHECKLIST.md.

---

## File Structure

Files to be created (no existing files modified):

```
/home/leo/Documentos/projetos/padrao/.claude/skills/ddd-hexagonal/
├── SKILL.md
├── CHECKLIST.md
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
    ├── tokens.ts.template
    └── tests/
        ├── entity.spec.ts.template
        └── use-case.spec.ts.template
```

Each `.template` file contains a header comment naming the live reference in `apps/api/src/contexts/users/`. Each template is ≤ 60 lines (synthetic, minimum viable).

---

## Task 1: Criar o diretório e o esqueleto da skill

**Files:**
- Create: `.claude/skills/ddd-hexagonal/` (directory)
- Create: `.claude/skills/ddd-hexagonal/templates/` (directory)
- Create: `.claude/skills/ddd-hexagonal/templates/tests/` (directory)

- [ ] **Step 1.1: Criar diretórios**

```bash
mkdir -p /home/leo/Documentos/projetos/padrao/.claude/skills/ddd-hexagonal/templates/tests
```

- [ ] **Step 1.2: Verificar criação**

```bash
ls -la /home/leo/Documentos/projetos/padrao/.claude/skills/ddd-hexagonal/templates/tests
```

Expected: directory exists, empty (or containing `.` and `..`).

- [ ] **Step 1.3: Commit do esqueleto**

```bash
cd /home/leo/Documentos/projetos/padrao
git add .claude/skills/ddd-hexagonal
git commit -m "feat(skills): scaffold ddd-hexagonal skill directory structure"
```

---

## Task 2: Escrever `SKILL.md`

**Files:**
- Create: `.claude/skills/ddd-hexagonal/SKILL.md`

- [ ] **Step 2.1: Criar o arquivo com frontmatter e visão geral**

```markdown
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
```

Save to `/home/leo/Documentos/projetos/padrao/.claude/skills/ddd-hexagonal/SKILL.md`.

- [ ] **Step 2.2: Adicionar seção 2 — Estrutura de pastas prescritiva**

Append to `SKILL.md`:

```markdown

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
```

- [ ] **Step 2.3: Adicionar seção 3 — Workflow de criação (8 steps)**

Append:

```markdown

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
```

- [ ] **Step 2.4: Adicionar seção 4 — Anti-patterns**

Append:

```markdown

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
```

- [ ] **Step 2.5: Adicionar seção 5 — Testing**

Append:

```markdown

## 5. Testing

| Camada | Tipo | Ferramenta | Mínimo |
|---|---|---|---|
| `domain/` | Unit puro | Vitest | Cobertura de cada invariante + cada método público |
| `application/` | Unit com in-memory repo | Vitest | Cada use case: happy + cada erro mapeado |
| `infrastructure/persistence/` | Integration com Postgres | Vitest + `@ai-padrao/db` | Roundtrip Prisma → mapper → domain → mapper → Prisma |
| `infrastructure/http/` | E2e (Nest + Supertest) | Vitest + Supertest | Cada rota: 2xx + 4xx + auth (quando aplicável) |

**Regra absoluta:** zero `.skip` / `.todo` / `--passWithNoTests` (regra INC-012).
```

- [ ] **Step 2.6: Adicionar seção 6 — Referências vivas**

Append:

```markdown

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
```

- [ ] **Step 2.7: Validar SKILL.md**

```bash
wc -l /home/leo/Documentos/projetos/padrao/.claude/skills/ddd-hexagonal/SKILL.md
```

Expected: ~250 lines (between 200 and 320).

- [ ] **Step 2.8: Commit**

```bash
cd /home/leo/Documentos/projetos/padrao
git add .claude/skills/ddd-hexagonal/SKILL.md
git commit -m "feat(skills): add ddd-hexagonal SKILL.md prescriptive guide"
```

---

## Task 3: Escrever `CHECKLIST.md`

**Files:**
- Create: `.claude/skills/ddd-hexagonal/CHECKLIST.md`

- [ ] **Step 3.1: Criar o arquivo com 6 seções de gates**

```markdown
# CHECKLIST — Bounded Context Self-Check

Rodar todos os itens antes de pedir review da feature. Cada `✓` significa verificado; cada `✗` significa corrigir antes de pedir review.

## 1. Domain purity

- [ ] `apps/api/src/contexts/<ctx>/domain/` NÃO importa `@nestjs/*`
  ```bash
  grep -rn "@nestjs" apps/api/src/contexts/<ctx>/domain/
  # Expected: empty output
  ```
- [ ] `apps/api/src/contexts/<ctx>/domain/` NÃO importa `@prisma/*`
  ```bash
  grep -rn "@prisma" apps/api/src/contexts/<ctx>/domain/
  # Expected: empty output
  ```
- [ ] Toda entity tem invariantes validadas no construtor (sem setters crus)
- [ ] Value Objects são imutáveis (sem setters, retornam nova instância)

## 2. Application layer

- [ ] Cada use case tem `*.spec.ts` correspondente
  ```bash
  diff <(find apps/api/src/contexts/<ctx>/application/use-cases -name '*.use-case.ts' | sort) \
       <(find apps/api/src/contexts/<ctx>/application/use-cases -name '*.spec.ts' \
          | sed 's/\.spec\.ts$/.use-case.ts/' | sort)
  # Expected: no diff
  ```
- [ ] Use cases recebem port via construtor (NÃO `new PrismaXRepository()` direto)
- [ ] `application/` NÃO importa `@prisma/client`
  ```bash
  grep -rn "@prisma" apps/api/src/contexts/<ctx>/application/
  # Expected: empty output
  ```

## 3. Infrastructure (persistence)

- [ ] Mapper (`<entity>.mapper.ts`) existe para cada entity persistida
- [ ] Adapter (`prisma-<entity>.repository.ts`) implementa a port declarada em `domain/ports/`
- [ ] Mapper tem `*.spec.ts` (roundtrip puro)
- [ ] Adapter tem `*.spec.ts` (com DB de teste)

## 4. HTTP layer

- [ ] Controller usa `@Body() dto: X` com tipo derivado de schema Zod de `packages/contracts/src/`
- [ ] DTO NÃO duplica schema Zod — reusa via `z.infer<typeof X>`
- [ ] `@Public()` aplicado em endpoints que não precisam de auth
- [ ] Controller tem `*.spec.ts` (e2e via Supertest)

## 5. Module wiring

- [ ] `<ctx>-context.module.ts` registrado em `apps/api/src/app.module.ts`
- [ ] DI tokens são `Symbol` declarados em `<ctx>-context.tokens.ts` (não string, não classe concreta)
- [ ] Cada port tem binding: `{ provide: X_PORT, useClass: PrismaXRepository }`
- [ ] `import type` proibido em qualquer arquivo de DI (controllers, services, guards, strategies) — INC-003

## 6. Tests

- [ ] Zero `.skip` / `.todo` / `--passWithNoTests` (INC-012)
  ```bash
  grep -rn "\.skip\|\.todo\|passWithNoTests" apps/api/src/contexts/<ctx>/
  # Expected: empty output
  ```
- [ ] E2e em `apps/api/test/<ctx>.e2e-spec.ts` exercita ao menos 1 happy path + 1 erro por rota

---

**Status:** [ ] all green — ready for review

Data: _______________
Revisor: _______________
```

Save to `/home/leo/Documentos/projetos/padrao/.claude/skills/ddd-hexagonal/CHECKLIST.md`.

- [ ] **Step 3.2: Commit**

```bash
cd /home/leo/Documentos/projetos/padrao
git add .claude/skills/ddd-hexagonal/CHECKLIST.md
git commit -m "feat(skills): add ddd-hexagonal CHECKLIST.md validation gates"
```

---

## Task 4: Template — `entity.ts.template`

**Files:**
- Create: `.claude/skills/ddd-hexagonal/templates/entity.ts.template`

- [ ] **Step 4.1: Criar template**

```ts
// Template: Domain Entity (framework-free)
// Reference (live example): apps/api/src/contexts/users/domain/entities/user.ts
//
// Convenção ai-padrao:
// - Constructor privado + factory method `build()` para validação
// - Props imutáveis (private readonly)
// - Métodos de domínio retornam NOVA instância (não mutam)
// - toJSON() para serialização (DTO em @ai-padrao/contracts)

import type { <Entity>Dto } from "@ai-padrao/contracts";
import { <ValueObject1> } from "../value-objects/<value-object-1>";

export interface <Entity>PrimitiveProps {
  id: string;
  // ...primitive fields (strings, dates, numbers)
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

interface <Entity>Props {
  id: string;
  <field1>: <ValueObject1>;
  // ...rich domain types
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class <Entity> {
  private constructor(private readonly props: <Entity>Props) {}

  static build(p: <Entity>PrimitiveProps): <Entity> {
    // Validate invariants HERE (throw on violation)
    return new <Entity>({
      id: p.id,
      <field1>: <ValueObject1>.create(p.<field1>),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      version: p.version,
    });
  }

  // Getters (read-only access)
  get id(): string { return this.props.id; }
  get <field1>(): <ValueObject1> { return this.props.<field1>; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get version(): number { return this.props.version; }

  // Domain methods (return new instance if mutated)
  rename(next: <ValueObject1>): <Entity> {
    if (this.props.<field1>.equals(next)) {
      return this;
    }
    return new <Entity>({ ...this.props, <field1>: next, updatedAt: new Date() });
  }

  toJSON(): <Entity>Dto {
    return {
      id: this.props.id,
      <field1>: this.props.<field1>.value,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
      version: this.props.version,
    };
  }
}
```

- [ ] **Step 4.2: Commit**

```bash
cd /home/leo/Documentos/projetos/padrao
git add .claude/skills/ddd-hexagonal/templates/entity.ts.template
git commit -m "feat(skills): add entity.ts.template to ddd-hexagonal"
```

---

## Task 5: Template — `value-object.ts.template`

**Files:**
- Create: `.claude/skills/ddd-hexagonal/templates/value-object.ts.template`

- [ ] **Step 5.1: Criar template**

```ts
// Template: Value Object (immutable, self-validating)
// Reference (live example): apps/api/src/contexts/users/domain/value-objects/email.ts
//
// Convenção ai-padrao:
// - Constructor privado + static factory `create()` que valida
// - Imutável: sem setters, sem mutação interna
// - Método `equals()` para comparação
// - `value` getter para extrair o primitivo
// - Throws em violação de invariante

export class <ValueObject> {
  private constructor(private readonly _value: string) {}

  static create(raw: string): <ValueObject> {
    // Validate HERE (throw on violation)
    if (raw.trim().length === 0) {
      throw new Error("<ValueObject> cannot be empty");
    }
    return new <ValueObject>(raw.trim());
  }

  get value(): string {
    return this._value;
  }

  equals(other: <ValueObject>): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
```

- [ ] **Step 5.2: Commit**

```bash
cd /home/leo/Documentos/projetos/padrao
git add .claude/skills/ddd-hexagonal/templates/value-object.ts.template
git commit -m "feat(skills): add value-object.ts.template to ddd-hexagonal"
```

---

## Task 6: Template — `aggregate.ts.template`

**Files:**
- Create: `.claude/skills/ddd-hexagonal/templates/aggregate.ts.template`

- [ ] **Step 6.1: Criar template**

```ts
// Template: Aggregate Root (entity with child entities / value objects)
// Reference (live example): synthético puro — apps/api/src/contexts/users/users.ts já é aggregate root
//
// Quando usar: quando a entity TEM child entities que devem ser modificadas apenas via root.
// Se sua entity não tem filhos, use entity.ts.template e delete este arquivo.
//
// Convenção ai-padrao:
// - Mesmas regras de entity.ts.template
// - Métodos que modificam filhos passam PELO root (child não é mutado diretamente)

import { <ChildEntity> } from "./<child-entity>";

interface <Aggregate>Props {
  id: string;
  children: <ChildEntity>[];
  // ...
}

export class <Aggregate> {
  private constructor(private readonly props: <Aggregate>Props) {}

  static build(p: { id: string; children: <ChildEntity>[] }): <Aggregate> {
    // validate invariants
    return new <Aggregate>(p);
  }

  get id(): string { return this.props.id; }
  get children(): readonly <ChildEntity>[] { return this.props.children; }

  addChild(child: <ChildEntity>): <Aggregate> {
    if (this.props.children.some((c) => c.id === child.id)) {
      return this; // already present, no-op
    }
    return new <Aggregate>({
      ...this.props,
      children: [...this.props.children, child],
    });
  }

  removeChild(childId: string): <Aggregate> {
    return new <Aggregate>({
      ...this.props,
      children: this.props.children.filter((c) => c.id !== childId),
    });
  }
}
```

- [ ] **Step 6.2: Commit**

```bash
cd /home/leo/Documentos/projetos/padrao
git add .claude/skills/ddd-hexagonal/templates/aggregate.ts.template
git commit -m "feat(skills): add aggregate.ts.template to ddd-hexagonal"
```

---

## Task 7: Template — `repository-port.ts.template`

**Files:**
- Create: `.claude/skills/ddd-hexagonal/templates/repository-port.ts.template`

- [ ] **Step 7.1: Criar template**

```ts
// Template: Repository Port (outbound interface for persistence)
// Reference (live example): apps/api/src/contexts/users/domain/ports/user-repository.port.ts
//
// Convenção ai-padrao:
// - Interface pura, sem implementação
// - NUNCA importa o adapter (Prisma). O adapter implementa esta interface
// - Retorna entities de domínio, NÃO records Prisma
// - NUNCA importa o DI token — o token vive em <ctx>-context.tokens.ts

import type { <Entity> } from "../entities/<entity>";

export interface <<Entity>RepositoryPort> {
  findById(id: string): Promise<<Entity> | null>;
  findBy<Field>(value: string): Promise<<Entity> | null>;
  save(entity: <Entity>): Promise<<Entity>>;
  delete(id: string): Promise<void>;
  // Add other methods as needed (list, update, etc.)
}
```

- [ ] **Step 7.2: Commit**

```bash
cd /home/leo/Documentos/projetos/padrao
git add .claude/skills/ddd-hexagonal/templates/repository-port.ts.template
git commit -m "feat(skills): add repository-port.ts.template to ddd-hexagonal"
```

---

## Task 8: Template — `mapper.ts.template`

**Files:**
- Create: `.claude/skills/ddd-hexagonal/templates/mapper.ts.template`

- [ ] **Step 8.1: Criar template**

```ts
// Template: Prisma Mapper (Prisma Record <-> Domain Entity)
// Reference (live example): apps/api/src/contexts/users/infrastructure/persistence/prisma/user.mapper.ts
//
// Convenção ai-padrao:
// - Static methods only, no instance state
// - Bidirectional: toDomain(prisma) and toPrisma(entity)
// - Mapper NÃO importa o port — só o entity
// - Roundtrip test obrigatório: toDomain(toPrisma(x)) deep-equals x

import { <Entity> } from "../../../domain/entities/<entity>";

type <Entity>Record = {
  id: string;
  // ...all primitive fields from schema.prisma
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export class <Entity>Mapper {
  static toDomain(record: <Entity>Record): <Entity> {
    return <Entity>.build({
      id: record.id,
      // ...map fields, converting strings to ValueObjects
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      version: record.version,
    });
  }

  static toPrisma(entity: <Entity>): <Entity>Record {
    return {
      id: entity.id,
      // ...map fields, converting ValueObjects back to primitives
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      version: entity.version,
    };
  }
}
```

- [ ] **Step 8.2: Commit**

```bash
cd /home/leo/Documentos/projetos/padrao
git add .claude/skills/ddd-hexagonal/templates/mapper.ts.template
git commit -m "feat(skills): add mapper.ts.template to ddd-hexagonal"
```

---

## Task 9: Template — `repository-adapter.ts.template`

**Files:**
- Create: `.claude/skills/ddd-hexagonal/templates/repository-adapter.ts.template`

- [ ] **Step 9.1: Criar template**

```ts
// Template: Prisma Repository Adapter (implements RepositoryPort)
// Reference (live example): apps/api/src/contexts/users/infrastructure/persistence/prisma/prisma-user.repository.ts
//
// Convenção ai-padrao:
// - Implementa a port via `implements <Entity>RepositoryPort`
// - Recebe PrismaClient via construtor (não `new PrismaClient()`)
// - Toda query passa pelo mapper antes de retornar para application/
// - Emite erros de domínio (`<Entity>NotFoundError`), nunca strings cruas

import { PrismaClient } from "@prisma/client";
import { <Entity> } from "../../../domain/entities/<entity>";
import { <Entity>NotFoundError } from "../../../domain/errors/<entity>-not-found.error";
import type { <<Entity>RepositoryPort> } from "../../../domain/ports/<entity>-repository.port";
import { <Entity>Mapper } from "./<entity>.mapper";

export class Prisma<Entity>Repository implements <<Entity>RepositoryPort> {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<<Entity> | null> {
    const record = await this.prisma.<entity>.findUnique({ where: { id } });
    return record ? <Entity>Mapper.toDomain(record) : null;
  }

  async findBy<Field>(value: string): Promise<<Entity> | null> {
    const record = await this.prisma.<entity>.findUnique({ where: { <field>: value } });
    return record ? <Entity>Mapper.toDomain(record) : null;
  }

  async save(entity: <Entity>): Promise<<Entity>> {
    const data = <Entity>Mapper.toPrisma(entity);
    const record = await this.prisma.<entity>.upsert({
      where: { id: entity.id },
      create: data,
      update: data,
    });
    return <Entity>Mapper.toDomain(record);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.<entity>.findUnique({ where: { id } });
    if (!existing) {
      throw new <Entity>NotFoundError(id);
    }
    await this.prisma.<entity>.delete({ where: { id } });
  }
}
```

- [ ] **Step 9.2: Commit**

```bash
cd /home/leo/Documentos/projetos/padrao
git add .claude/skills/ddd-hexagonal/templates/repository-adapter.ts.template
git commit -m "feat(skills): add repository-adapter.ts.template to ddd-hexagonal"
```

---

## Task 10: Template — `use-case.ts.template`

**Files:**
- Create: `.claude/skills/ddd-hexagonal/templates/use-case.ts.template`

- [ ] **Step 10.1: Criar template**

```ts
// Template: Application Use Case (orchestrates domain + port)
// Reference (live example): apps/api/src/contexts/users/application/use-cases/find-user.use-case.ts
//
// Convenção ai-padrao:
// - Recebe a PORT via construtor (não a classe concreta)
// - SEM `@Injectable()` — use case é puro, framework-free
// - Retorna DTO ou entity; nunca retorna o PrismaRecord
// - Cada método público é um caso de uso

import { <Entity> } from "../../domain/entities/<entity>";
import { <Entity>NotFoundError } from "../../domain/errors/<entity>-not-found.error";
import type { <<Entity>RepositoryPort> } from "../../domain/ports/<entity>-repository.port";

export class <Verb><Entity>UseCase {
  constructor(private readonly repository: <<Entity>RepositoryPort>) {}

  async execute(id: string): Promise<<Entity>> {
    const entity = await this.repository.findById(id);
    if (!entity) {
      throw new <Entity>NotFoundError(id);
    }
    return entity;
  }
}
```

- [ ] **Step 10.2: Commit**

```bash
cd /home/leo/Documentos/projetos/padrao
git add .claude/skills/ddd-hexagonal/templates/use-case.ts.template
git commit -m "feat(skills): add use-case.ts.template to ddd-hexagonal"
```

---

## Task 11: Template — `in-memory-repository.ts.template`

**Files:**
- Create: `.claude/skills/ddd-hexagonal/templates/in-memory-repository.ts.template`

- [ ] **Step 11.1: Criar template**

```ts
// Template: In-Memory Repository (test double for use case tests)
// Reference (live example): apps/api/src/contexts/users/application/testing/in-memory-user.repository.ts
//
// Convenção ai-padrao:
// - Implementa a port com Map<id, entity> em memória
// - Lógica idêntica ao adapter real (happy + errors)
// - Reset method para cleanup entre tests
// - SEM framework (sem @Injectable)

import { <Entity> } from "../../domain/entities/<entity>";
import type { <<Entity>RepositoryPort> } from "../../domain/ports/<entity>-repository.port";

export class InMemory<Entity>Repository implements <<Entity>RepositoryPort> {
  private readonly store = new Map<string, <Entity>>();

  async findById(id: string): Promise<<Entity> | null> {
    return this.store.get(id) ?? null;
  }

  async findBy<Field>(value: string): Promise<<Entity> | null> {
    for (const entity of this.store.values()) {
      if (entity.<field> === value) {
        return entity;
      }
    }
    return null;
  }

  async save(entity: <Entity>): Promise<<Entity>> {
    this.store.set(entity.id, entity);
    return entity;
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  // Test helper — NOT part of the port
  reset(): void {
    this.store.clear();
  }
}
```

- [ ] **Step 11.2: Commit**

```bash
cd /home/leo/Documentos/projetos/padrao
git add .claude/skills/ddd-hexagonal/templates/in-memory-repository.ts.template
git commit -m "feat(skills): add in-memory-repository.ts.template to ddd-hexagonal"
```

---

## Task 12: Template — `controller.ts.template`

**Files:**
- Create: `.claude/skills/ddd-hexagonal/templates/controller.ts.template`

- [ ] **Step 12.1: Criar template**

```ts
// Template: HTTP Controller (NestJS, Fastify)
// Reference (live example): apps/api/src/contexts/users/infrastructure/http/users-http.controller.ts
//
// Convenção ai-padrao:
// - Recebe use cases via construtor (NÃO services)
// - DTOs são tipos derivados de Zod schemas em @ai-padrao/contracts
// - Endpoints públicos usam `@Public()` (skip JWT)
// - Fastify: usar `.header()` em vez de `.setHeader()` (INC-002)

import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { z } from "zod";
import { <Create><Entity>Dto } from "@ai-padrao/contracts";
import { <Verb><Entity>UseCase } from "../../../application/use-cases/<verb>-<entity>.use-case";

@Controller("<entities>")
export class <Entities>HttpController {
  constructor(private readonly <verb><Entity>UseCase: <Verb><Entity>UseCase) {}

  @Get(":id")
  async findOne(@Param("id") id: string) {
    const entity = await this.<verb><Entity>UseCase.execute(id);
    return entity.toJSON();
  }

  @Post()
  async create(@Body() dto: z.infer<typeof <Create><Entity>Dto>) {
    // delegate to a Create<Entity>UseCase
    // ...
  }
}
```

- [ ] **Step 12.2: Commit**

```bash
cd /home/leo/Documentos/projetos/padrao
git add .claude/skills/ddd-hexagonal/templates/controller.ts.template
git commit -m "feat(skills): add controller.ts.template to ddd-hexagonal"
```

---

## Task 13: Template — `module.ts.template`

**Files:**
- Create: `.claude/skills/ddd-hexagonal/templates/module.ts.template`

- [ ] **Step 13.1: Criar template**

```ts
// Template: NestJS Module (DI wiring for the bounded context)
// Reference (live example): apps/api/src/contexts/users/users-context.module.ts
//
// Convenção ai-padrao:
// - Importa PrismaModule do @ai-padrao/db (NÃO cria PrismaClient próprio)
// - Registra cada port com `{ provide: PORT_TOKEN, useClass: PrismaAdapter }`
// - Exports use cases que outros módulos podem consumir

import { Module } from "@nestjs/common";
import { PrismaModule } from "@ai-padrao/db";
import { <Create><Entity>UseCase } from "./application/use-cases/<create>-<entity>.use-case";
import { <Find><Entity>UseCase } from "./application/use-cases/<find>-<entity>.use-case";
import { <Entities>HttpController } from "./infrastructure/http/<entities>-http.controller";
import { Prisma<Entity>Repository } from "./infrastructure/persistence/prisma/prisma-<entity>.repository";
import { <ENTITY>_REPOSITORY_PORT } from "./<ctx>-context.tokens";

@Module({
  imports: [PrismaModule],
  controllers: [<Entities>HttpController],
  providers: [
    {
      provide: <ENTITY>_REPOSITORY_PORT,
      useClass: Prisma<Entity>Repository,
    },
    <Create><Entity>UseCase,
    <Find><Entity>UseCase,
  ],
  exports: [<Create><Entity>UseCase, <Find><Entity>UseCase],
})
export class <Ctx>ContextModule {}
```

- [ ] **Step 13.2: Commit**

```bash
cd /home/leo/Documentos/projetos/padrao
git add .claude/skills/ddd-hexagonal/templates/module.ts.template
git commit -m "feat(skills): add module.ts.template to ddd-hexagonal"
```

---

## Task 14: Template — `tokens.ts.template`

**Files:**
- Create: `.claude/skills/ddd-hexagonal/templates/tokens.ts.template`

- [ ] **Step 14.1: Criar template**

```ts
// Template: DI Tokens (Symbol-based, declared at context level)
// Reference (live example): apps/api/src/contexts/users/users-context.tokens.ts
//
// Convenção ai-padrao:
// - Tokens vivem no contexto, NÃO no domain/ (domain fica puro)
// - Um Symbol por port
// - Convenção: `<ENTIDADE>_REPOSITORY_PORT` em UPPER_SNAKE_CASE
// - Description string no Symbol é só para debugging (não afeta DI)

/**
 * DI token for the <Entity>RepositoryPort. Using a symbol keeps the
 * domain interface resolvable through Nest DI without forcing a runtime
 * dependency on the domain module.
 */
export const <ENTITY>_REPOSITORY_PORT = Symbol("<Entity>RepositoryPort");
```

- [ ] **Step 14.2: Commit**

```bash
cd /home/leo/Documentos/projetos/padrao
git add .claude/skills/ddd-hexagonal/templates/tokens.ts.template
git commit -m "feat(skills): add tokens.ts.template to ddd-hexagonal"
```

---

## Task 15: Template — `tests/entity.spec.ts.template`

**Files:**
- Create: `.claude/skills/ddd-hexagonal/templates/tests/entity.spec.ts.template`

- [ ] **Step 15.1: Criar template**

```ts
// Template: Entity unit tests (Vitest, pure)
// Reference (live example): apps/api/src/contexts/users/domain/entities/user.spec.ts
//
// Convenção ai-padrao:
// - Testa cada invariante (constructor throws)
// - Testa cada método de domínio (happy + edge case)
// - Testa toJSON() shape

import { describe, it, expect } from "vitest";
import { <Entity> } from "<entity>";

describe("<Entity>", () => {
  describe("build()", () => {
    it("rejects invalid primitive props", () => {
      expect(() => <Entity>.build({ /* invalid */ } as any)).toThrow();
    });

    it("accepts valid primitive props", () => {
      const entity = <Entity>.build({
        id: "id-1",
        // ...valid fields
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 0,
      });
      expect(entity.id).toBe("id-1");
    });
  });

  describe("rename()", () => {
    it("returns a new instance with updated field", () => {
      const entity = <Entity>.build({ /* valid */ });
      const next = /* new ValueObject */;
      const renamed = entity.rename(next);
      expect(renamed).not.toBe(entity);
      expect(renamed.<field>).toBe(next);
    });

    it("returns same instance if no change", () => {
      const entity = <Entity>.build({ /* valid */ });
      const same = entity.rename(entity.<field>);
      expect(same).toBe(entity);
    });
  });

  describe("toJSON()", () => {
    it("serializes to DTO shape", () => {
      const entity = <Entity>.build({ /* valid */ });
      const json = entity.toJSON();
      expect(json).toMatchObject({ id: entity.id /* ... */ });
    });
  });
});
```

- [ ] **Step 15.2: Commit**

```bash
cd /home/leo/Documentos/projetos/padrao
git add .claude/skills/ddd-hexagonal/templates/tests/entity.spec.ts.template
git commit -m "feat(skills): add entity.spec.ts.template to ddd-hexagonal"
```

---

## Task 16: Template — `tests/use-case.spec.ts.template`

**Files:**
- Create: `.claude/skills/ddd-hexagonal/templates/tests/use-case.spec.ts.template`

- [ ] **Step 16.1: Criar template**

```ts
// Template: Use Case unit tests (Vitest, with in-memory repo)
// Reference (live example): apps/api/src/contexts/users/application/use-cases/find-user.use-case.spec.ts
//
// Convenção ai-padrao:
// - Usa InMemory<Entity>Repository (não mock — fake)
// - Testa happy path + cada erro mapeado
// - beforeEach: cria entities de teste

import { beforeEach, describe, it, expect } from "vitest";
import { <Entity> } from "<entity>";
import { InMemory<Entity>Repository } from "<in-memory-repo>";
import { <Verb><Entity>UseCase } from "<use-case>";

describe("<Verb><Entity>UseCase", () => {
  let repository: InMemory<Entity>Repository;
  let sut: <Verb><Entity>UseCase;

  beforeEach(() => {
    repository = new InMemory<Entity>Repository();
    sut = new <Verb><Entity>UseCase(repository);
  });

  it("returns entity when found", async () => {
    const entity = <Entity>.build({ /* valid */ });
    await repository.save(entity);

    const result = await sut.execute(entity.id);

    expect(result.id).toBe(entity.id);
  });

  it("throws <Entity>NotFoundError when not found", async () => {
    await expect(sut.execute("missing-id")).rejects.toThrow("<Entity>NotFoundError");
  });
});
```

- [ ] **Step 16.2: Commit**

```bash
cd /home/leo/Documentos/projetos/padrao
git add .claude/skills/ddd-hexagonal/templates/tests/use-case.spec.ts.template
git commit -m "feat(skills): add use-case.spec.ts.template to ddd-hexagonal"
```

---

## Task 17: Verificação final (acceptance criteria)

- [ ] **Step 17.1: Verificar estrutura criada**

```bash
find /home/leo/Documentos/projetos/padrao/.claude/skills/ddd-hexagonal -type f | sort
```

Expected output (13 files):

```
.claude/skills/ddd-hexagonal/CHECKLIST.md
.claude/skills/ddd-hexagonal/SKILL.md
.claude/skills/ddd-hexagonal/templates/aggregate.ts.template
.claude/skills/ddd-hexagonal/templates/controller.ts.template
.claude/skills/ddd-hexagonal/templates/entity.ts.template
.claude/skills/ddd-hexagonal/templates/in-memory-repository.ts.template
.claude/skills/ddd-hexagonal/templates/mapper.ts.template
.claude/skills/ddd-hexagonal/templates/module.ts.template
.claude/skills/ddd-hexagonal/templates/repository-adapter.ts.template
.claude/skills/ddd-hexagonal/templates/repository-port.ts.template
.claude/skills/ddd-hexagonal/templates/tokens.ts.template
.claude/skills/ddd-hexagonal/templates/use-case.ts.template
.claude/skills/ddd-hexagonal/templates/value-object.ts.template
.claude/skills/ddd-hexagonal/templates/tests/entity.spec.ts.template
.claude/skills/ddd-hexagonal/templates/tests/use-case.spec.ts.template
```

- [ ] **Step 17.2: Confirmar tamanho do SKILL.md**

```bash
wc -l /home/leo/Documentos/projetos/padrao/.claude/skills/ddd-hexagonal/SKILL.md
```

Expected: 200–320 lines.

- [ ] **Step 17.3: Confirmar que cada template cita o arquivo de referência**

```bash
for f in /home/leo/Documentos/projetos/padrao/.claude/skills/ddd-hexagonal/templates/*.template \
         /home/leo/Documentos/projetos/padrao/.claude/skills/ddd-hexagonal/templates/tests/*.template; do
  echo "--- $f ---"
  head -3 "$f"
done
```

Expected: every template's first 3 lines contain `Reference (live example): apps/api/src/contexts/users/...` OR a clear note that it's synthetic (`// synthético puro`).

- [ ] **Step 17.4: Confirmar convenção de DI tokens nos templates relevantes**

```bash
grep -n "Symbol(" /home/leo/Documentos/projetos/padrao/.claude/skills/ddd-hexagonal/templates/tokens.ts.template
grep -n "_REPOSITORY_PORT" /home/leo/Documentos/projetos/padrao/.claude/skills/ddd-hexagonal/templates/module.ts.template
```

Expected: `tokens.ts.template` declares `Symbol(...)`; `module.ts.template` uses `_REPOSITORY_PORT` constant.

- [ ] **Step 17.5: Verificar que cada template não importa framework no domínio**

```bash
grep -rn "@nestjs\|@prisma" /home/leo/Documentos/projetos/padrao/.claude/skills/ddd-hexagonal/templates/entity.ts.template \
                                 /home/leo/Documentos/projetos/padrao/.claude/skills/ddd-hexagonal/templates/value-object.ts.template \
                                 /home/leo/Documentos/projetos/padrao/.claude/skills/ddd-hexagonal/templates/aggregate.ts.template \
                                 /home/leo/Documentos/projetos/padrao/.claude/skills/ddd-hexagonal/templates/repository-port.ts.template
```

Expected: empty output (domain templates don't import framework).

- [ ] **Step 17.6: Commit final de verificação (sem mudanças)**

```bash
cd /home/leo/Documentos/projetos/padrao
git status
# Expected: nothing to commit (all changes already committed in prior tasks)
```

- [ ] **Step 17.7: Push (opcional, requer decisão do humano)**

```bash
cd /home/leo/Documentos/projetos/padrao
git push origin feat/domain-audit-foundation
```

---

## Self-Review

**1. Spec coverage:**

| Spec section | Covered by task |
|---|---|
| §2.1 Skill location | Task 1 |
| §2.2 Frontmatter | Task 2.1 |
| §2.3 Canonical layering | Task 2.2 |
| §2.4 Sourcing strategy | All template tasks (header comments) |
| §3 Step 1 (ubiquitous language) | Task 2.3 |
| §3 Steps 2–8 | Task 2.3 |
| §4.1 Anti-patterns | Task 2.4 |
| §4.2 CHECKLIST | Task 3 |
| §4.3 Testing matrix | Task 2.5 |
| §5 Out of scope | (Implicit — not implemented) |
| §6 Decisions | (Implicit — followed throughout) |
| §7 Verification | Task 17 |

**2. Placeholder scan:** No "TBD", "TODO", "implement later", "fill in details" in the plan. Each code block is complete.

**3. Type consistency:** All templates use consistent naming:
- Entity class: `<Entity>` (PascalCase singular)
- Port: `<<Entity>RepositoryPort>` (interface with one capital + `RepositoryPort` suffix)
- Token: `<ENTITY>_REPOSITORY_PORT` (UPPER_SNAKE_CASE)
- Adapter: `Prisma<Entity>Repository`
- Use case: `<Verb><Entity>UseCase`
- Mapper: `<Entity>Mapper`

All template variables are wrapped in `<...>` so they cannot be confused with runtime values.