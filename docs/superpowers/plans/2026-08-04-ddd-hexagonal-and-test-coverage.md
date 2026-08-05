# DDD, Hexagonal Architecture, and 80% Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Incrementally migrate `apps/api` and `apps/web` to vertical DDD/hexagonal contexts while preserving public behavior and enforcing at least 80% statements, branches, functions, and lines independently in each app.

**Architecture:** Business capabilities live in vertical contexts whose dependencies point from inbound adapters to application use cases and domain objects. Prisma, NestJS, Next.js, React, HTTP, cookies, JWT, and hashing stay in adapters behind explicit ports; the migration swaps one context at a time and retains the existing contracts from `packages/contracts`.

**Tech Stack:** TypeScript, NestJS 11, Fastify 5, Prisma 6, Jest 29, Next.js 15 App Router, React 19, Vitest 2.1, happy-dom, Zod contracts, pnpm 9, Turborepo 2, ESLint 9, OpenSpec.

**Design:** [`../specs/2026-08-04-ddd-hexagonal-and-test-coverage-design.md`](../specs/2026-08-04-ddd-hexagonal-and-test-coverage-design.md)

---

## Execution constraints

1. The app-specific rules already exist in `apps/api/AGENTS.md` and
   `apps/web/AGENTS.md`; the root `AGENTS.md` links to both.
2. Task 1 creates the mandatory OpenSpec change. Stop after Task 1 and obtain
   explicit human approval before Task 2.
3. Preserve all routes, status codes, request/response schemas, cookie names,
   JWT claims, TTL defaults, Prisma schema, and web routes unless the approved
   OpenSpec delta says otherwise.
4. Never use skipped/todo/conditional tests or `--passWithNoTests`.
5. Never lower a coverage threshold, add an ignore directive to business code,
   or broaden coverage exclusions to pass the gate.
6. Run the L2 detector after each edit. If it reports an INC pattern, follow the
   root `AGENTS.md` confirmation procedure.
7. Every commit body references the corresponding task number. Only these
   scopes are valid: `root`, `api`, `web`, `contracts`, `db`, `ui`, `config`,
   `docker`, `sdd`, `deps`.

## Target file structure

### API

```text
apps/api/src/contexts/
├── users/
│   ├── domain/
│   │   ├── entities/user.ts
│   │   ├── errors/user-not-found.error.ts
│   │   ├── ports/user-repository.port.ts
│   │   └── value-objects/{email,name,user-role}.ts
│   ├── application/use-cases/
│   │   ├── find-user.use-case.ts
│   │   ├── list-users.use-case.ts
│   │   ├── remove-user.use-case.ts
│   │   └── update-user.use-case.ts
│   ├── adapters/inbound/http/
│   │   ├── dto/users.dto.ts
│   │   └── users.controller.ts
│   ├── infrastructure/prisma/
│   │   ├── prisma-user.mapper.ts
│   │   └── prisma-user.repository.ts
│   └── users.module.ts
└── auth/
    ├── domain/
    │   ├── errors/
    │   ├── ports/
    │   └── value-objects/
    ├── application/use-cases/
    │   ├── login.use-case.ts
    │   ├── logout.use-case.ts
    │   ├── refresh-session.use-case.ts
    │   └── register.use-case.ts
    ├── adapters/inbound/http/
    │   ├── auth.controller.ts
    │   ├── dto/auth.dto.ts
    │   └── jwt.strategy.ts
    ├── infrastructure/adapters/
    │   ├── argon2-password-hasher.adapter.ts
    │   ├── jwt-access-token-issuer.adapter.ts
    │   ├── node-token-generator.adapter.ts
    │   ├── prisma-refresh-token-store.adapter.ts
    │   └── prisma-user-auth.repository.ts
    └── auth.module.ts
```

### Web

```text
apps/web/src/features/auth/
├── domain/
│   ├── errors/auth-flow.error.ts
│   └── ports/
│       ├── auth-api.port.ts
│       ├── auth-cookie-store.port.ts
│       └── auth-navigation.port.ts
├── application/use-cases/
│   ├── login.use-case.ts
│   ├── logout.use-case.ts
│   ├── refresh-session.use-case.ts
│   └── register.use-case.ts
├── adapters/presentation/
│   ├── login-form.tsx
│   └── register-form.tsx
└── infrastructure/adapters/
    ├── fetch-auth-api.adapter.ts
    ├── next-auth-cookie-store.adapter.ts
    └── next-auth-navigation.adapter.ts
```

Composition roots remain in Nest modules, Next.js App Router pages/server-action
factories, and middleware entry points. They may import all layers solely to
assemble dependencies.

---

### Task 1: Open and approve the OpenSpec change

**Files:**

- Create: `.openspec/changes/ddd-hexagonal-coverage/proposal.md`
- Create: `.openspec/changes/ddd-hexagonal-coverage/tasks.md`
- Create: `.openspec/changes/ddd-hexagonal-coverage/design.md`
- Create: `.openspec/changes/ddd-hexagonal-coverage/specs/architecture/spec.md`
- Reference: `.openspec/AGENTS.md`
- Reference: `docs/superpowers/specs/2026-08-04-ddd-hexagonal-and-test-coverage-design.md`

- [ ] **Step 1: Create the proposal**

```markdown
# Change: Adopt DDD/hexagonal contexts and enforce 80% app coverage

## Why

The current API services mix business orchestration with Prisma, JWT, and
hashing, while the web mixes application flow with Next.js and HTTP details.
Neither app currently enforces a coverage threshold.

## What changes

- Introduce vertical bounded contexts in `apps/api` and feature contexts in
  `apps/web`.
- Migrate `users`, API `auth`, and web `auth` incrementally behind ports.
- Preserve current HTTP, cookie, JWT, Prisma, and route contracts.
- Enforce 80% statements, branches, functions, and lines independently in each
  app.
- Add lint-based architecture guards.

## Impact

Application structure, dependency wiring, tests, coverage scripts, and CI/build
quality gates change. No database or public contract change is intended.
```

- [ ] **Step 2: Create the spec delta with testable requirements**

```markdown
# Architecture specification delta

## ADDED Requirements

### Requirement: Inward dependency direction

Both apps SHALL organize business capabilities as vertical contexts. Domain
code SHALL NOT import frameworks or infrastructure, and application code SHALL
depend on outbound capabilities through ports.

#### Scenario: API domain import validation

- **WHEN** lint runs against an API domain or application file
- **THEN** imports from NestJS, Fastify, Prisma, or infrastructure paths fail

#### Scenario: Web domain import validation

- **WHEN** lint runs against a web domain or application file
- **THEN** imports from React, Next.js, browser APIs, or infrastructure paths fail

### Requirement: Independent coverage gates

Each app SHALL enforce at least 80% statements, branches, functions, and lines.

#### Scenario: One metric is below 80%

- **WHEN** an app's coverage command reports any metric below 80%
- **THEN** that command and the aggregate root command fail

#### Scenario: Both apps meet all thresholds

- **WHEN** both app coverage commands report all four metrics at or above 80%
- **THEN** the aggregate coverage command succeeds

### Requirement: Contract preservation

The migration SHALL preserve existing API routes, status codes, Zod contracts,
cookie names, JWT claims, token rotation behavior, and web routes.
```

- [ ] **Step 3: Copy the approved architecture and migration sequence into `design.md`**

Use the design document linked in the header. Keep the decisions about vertical
contexts, inward dependencies, pragmatic frontend DDD, narrow exclusions, and
incremental order unchanged.

- [ ] **Step 4: Convert Tasks 2–15 of this plan into ordered OpenSpec checkboxes**

Each OpenSpec task must reference the corresponding task heading from this
plan, including its validation command.

- [ ] **Step 5: Validate the four-file change shape**

Run:

```bash
find .openspec/changes/ddd-hexagonal-coverage -type f -print | sort
```

Expected: exactly `proposal.md`, `tasks.md`, `design.md`, and
`specs/architecture/spec.md`.

- [ ] **Step 6: Commit the proposal**

```bash
git add .openspec/changes/ddd-hexagonal-coverage
git commit -m "docs(sdd): propose DDD hexagonal migration and coverage gate" -m "Task: 1"
```

- [ ] **Step 7: Stop for explicit human approval**

Do not begin Task 2 until the proposal is approved.

---

### Task 2: Capture coverage baselines without thresholds

**Files:**

- Modify: `apps/api/package.json`
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Create (temporary report only, do not commit): `apps/api/coverage/`
- Create (temporary report only, do not commit): `apps/web/coverage/`

- [ ] **Step 1: Add the Vitest coverage provider matching Vitest 2.1**

```bash
pnpm --filter @ai-padrao/web add -D @vitest/coverage-v8@^2.1.0
```

Expected: `apps/web/package.json` and `pnpm-lock.yaml` change; no production
dependency is added.

- [ ] **Step 2: Add temporary baseline scripts without a threshold**

Add to the API scripts:

```json
"test:coverage:baseline": "jest --coverage"
```

Add to the web scripts:

```json
"test:coverage:baseline": "VITE_CJS_IGNORE_WARNING=true vitest run --coverage"
```

These are temporary measurement scripts. They do not become the quality gate.

- [ ] **Step 3: Run the API baseline**

```bash
pnpm --filter @ai-padrao/api test:coverage:baseline
```

Expected: tests pass and Jest prints statements, branches, functions, and lines.
Record the four totals in the OpenSpec task notes.

- [ ] **Step 4: Run the web baseline**

```bash
pnpm --filter @ai-padrao/web test:coverage:baseline
```

Expected: tests pass and Vitest prints all four metrics. Record the totals.

- [ ] **Step 5: Ensure reports are ignored**

```bash
git status --short
```

Expected: no file under either `coverage/` directory appears as untracked.

- [ ] **Step 6: Commit the baseline tooling**

```bash
git add apps/api/package.json apps/web/package.json pnpm-lock.yaml
git commit -m "chore(deps): add per-app coverage baseline tooling" -m "Task: 2"
```

---

### Task 3: Add characterization tests for existing behavior

**Files:**

- Modify: `apps/api/src/modules/users/users.service.spec.ts`
- Modify: `apps/api/src/modules/auth/auth.service.spec.ts`
- Modify: `apps/api/test/auth.e2e-spec.ts`
- Create: `apps/web/src/lib/api-client.spec.ts`
- Create: `apps/web/src/lib/auth.spec.ts`
- Create: `apps/web/src/middleware.spec.ts`

- [ ] **Step 1: Add failing user-service cases**

Cover the query-filter branch, paginated result shape, successful update, missing
user, and removal. Use the existing mocked `PrismaService` shape and assert the
exact Prisma call arguments already produced by `UsersService`.

```ts
it("adds an OR filter when q is present", async () => {
  prisma.user.findMany.mockResolvedValue([]);
  prisma.user.count.mockResolvedValue(0);

  await service.list({ page: 1, pageSize: 20, q: "leo" });

  expect(prisma.user.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        OR: [
          { email: { contains: "leo", mode: "insensitive" } },
          { name: { contains: "leo", mode: "insensitive" } },
        ],
      },
    }),
  );
});
```

- [ ] **Step 2: Run the user service spec**

```bash
pnpm --filter @ai-padrao/api test src/modules/users/users.service.spec.ts
```

Expected: the new cases fail only where the mocks or expectations expose an
uncharacterized current branch; adjust test setup, not production behavior.

- [ ] **Step 3: Add auth refresh/logout branch cases**

```ts
it.each([
  ["missing", null],
  ["revoked", { revokedAt: new Date(), expiresAt: future }],
  ["expired", { revokedAt: null, expiresAt: past }],
])("rejects a %s refresh token", async (_label, stored) => {
  prisma.refreshToken.findUnique.mockResolvedValue(stored);
  await expect(service.refresh({ refreshToken: "token" })).rejects.toThrow(
    UnauthorizedException,
  );
});
```

Also assert that successful refresh revokes the old record and persists a new
hash, and that logout revokes by the current token hash.

- [ ] **Step 4: Add e2e regression coverage**

Use the existing e2e setup and route helpers. Add a login → refresh → logout →
refresh-rejected sequence. Assert the existing status codes and response schema;
do not introduce a new contract.

- [ ] **Step 5: Add deterministic web tests**

Mock `next/headers`, `next/navigation`, and `fetch` with `vi.mock` and
`vi.stubGlobal`. Cover:

```ts
it("retries one request after refreshing an expired access token", async () => {
  fetchMock
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(Response.json({ accessToken: "new-token" }))
    .mockResolvedValueOnce(Response.json({ id: "user-1" }));

  await expect(apiClient("/api/users/me")).resolves.toEqual({ id: "user-1" });
  expect(fetchMock).toHaveBeenCalledTimes(3);
});
```

For middleware, cover public-with-session, private-without-session, and
private-with-session branches while asserting the current matcher and redirects.

- [ ] **Step 6: Run all characterization tests**

```bash
pnpm --filter @ai-padrao/api test
pnpm --filter @ai-padrao/api test:e2e
pnpm --filter @ai-padrao/web test
```

Expected: all pass with no skipped or placeholder tests.

- [ ] **Step 7: Re-run baselines and record the improvement**

```bash
pnpm --filter @ai-padrao/api test:coverage:baseline
pnpm --filter @ai-padrao/web test:coverage:baseline
```

Expected: all four metrics are reported. If a metric remains below 80%, list
uncovered business files/branches in the OpenSpec tasks and add meaningful
characterization cases before Task 13; never alter the target.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules apps/api/test apps/web/src
git commit -m "test(root): characterize auth and users before architecture migration" -m "Task: 3"
```

---

### Task 4: Enforce architecture boundaries with existing ESLint tooling

**Files:**

- Modify: `apps/api/eslint.config.mjs`
- Modify: `apps/web/eslint.config.mjs`
- Test: representative temporary files created and removed during validation

- [ ] **Step 1: Add API domain/application restrictions**

Append flat-config entries equivalent to:

```js
{
  files: ['src/contexts/*/domain/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        '@nestjs/*',
        '@prisma/client',
        '@fastify/*',
        'fastify',
        '**/infrastructure/**',
        '**/adapters/**',
      ],
    }],
  },
},
{
  files: ['src/contexts/*/application/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        '@nestjs/*',
        '@prisma/client',
        '@fastify/*',
        'fastify',
        '**/infrastructure/**',
        '**/adapters/**',
      ],
    }],
  },
}
```

Merge this into the existing exported config shape rather than replacing shared
configuration.

- [ ] **Step 2: Add web domain/application restrictions**

```js
{
  files: ['src/features/*/{domain,application}/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        'react',
        'react/*',
        'next',
        'next/*',
        '**/infrastructure/**',
        '**/adapters/**',
      ],
    }],
  },
}
```

Keep `@ai-padrao/contracts` allowed. It is the shared transport schema source.

- [ ] **Step 3: Verify each rule fails on a forbidden import**

Create one temporary domain file per app containing a forbidden import, run the
app lint command, and confirm an error from `no-restricted-imports`. Remove both
temporary files immediately.

- [ ] **Step 4: Verify clean lint**

```bash
pnpm --filter @ai-padrao/api lint
pnpm --filter @ai-padrao/web lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/eslint.config.mjs apps/web/eslint.config.mjs
git commit -m "chore(config): enforce hexagonal dependency direction" -m "Task: 4"
```

---

### Task 5: Build the API users domain with pure tests

**Files:**

- Create: `apps/api/src/contexts/users/domain/value-objects/email.ts`
- Create: `apps/api/src/contexts/users/domain/value-objects/email.spec.ts`
- Create: `apps/api/src/contexts/users/domain/value-objects/name.ts`
- Create: `apps/api/src/contexts/users/domain/value-objects/name.spec.ts`
- Create: `apps/api/src/contexts/users/domain/value-objects/user-role.ts`
- Create: `apps/api/src/contexts/users/domain/entities/user.ts`
- Create: `apps/api/src/contexts/users/domain/entities/user.spec.ts`
- Create: `apps/api/src/contexts/users/domain/errors/user-not-found.error.ts`
- Create: `apps/api/src/contexts/users/domain/ports/user-repository.port.ts`

- [ ] **Step 1: Write failing value-object tests from existing contract limits**

Read the current Zod schemas in `packages/contracts` and use exactly their email,
name, and role constraints. Example shape:

```ts
describe("Email", () => {
  it("normalizes a valid email", () => {
    expect(Email.create(" User@Example.com ").value).toBe("user@example.com");
  });

  it("rejects an invalid email", () => {
    expect(() => Email.create("invalid")).toThrow("Invalid email");
  });
});
```

- [ ] **Step 2: Run the tests and confirm RED**

```bash
pnpm --filter @ai-padrao/api test src/contexts/users/domain
```

Expected: FAIL because the domain classes do not exist.

- [ ] **Step 3: Implement minimal framework-free value objects**

```ts
export class Email {
  private constructor(readonly value: string) {}

  static create(raw: string): Email {
    const value = raw.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw new Error("Invalid email");
    }
    return new Email(value);
  }
}
```

Implement `Name` using the exact contracts constraint and define `UserRole` as
a local string union/const object, never as a Prisma import.

- [ ] **Step 4: Define the entity and repository port**

```ts
export interface UserProps {
  id: string;
  email: Email;
  name: Name;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  constructor(readonly props: UserProps) {}

  rename(name: Name, now: Date): User {
    return new User({ ...this.props, name, updatedAt: now });
  }
}

export interface UserPage {
  items: User[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UserRepositoryPort {
  list(input: {
    page: number;
    pageSize: number;
    q?: string;
  }): Promise<UserPage>;
  findById(id: string): Promise<User | null>;
  updateName(id: string, name: Name): Promise<User | null>;
  remove(id: string): Promise<boolean>;
}

export const USER_REPOSITORY = Symbol("USER_REPOSITORY");
```

The symbol belongs next to the port for Nest composition, but the interface and
domain remain free of decorators.

- [ ] **Step 5: Run domain tests and lint**

```bash
pnpm --filter @ai-padrao/api test src/contexts/users/domain
pnpm --filter @ai-padrao/api lint
```

Expected: PASS and no forbidden imports.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/contexts/users/domain
git commit -m "feat(api): add users domain model and repository port" -m "Task: 5"
```

---

### Task 6: Build users application use cases with in-memory ports

**Files:**

- Create: `apps/api/src/contexts/users/application/use-cases/list-users.use-case.ts`
- Create: `apps/api/src/contexts/users/application/use-cases/list-users.use-case.spec.ts`
- Create: `apps/api/src/contexts/users/application/use-cases/find-user.use-case.ts`
- Create: `apps/api/src/contexts/users/application/use-cases/find-user.use-case.spec.ts`
- Create: `apps/api/src/contexts/users/application/use-cases/update-user.use-case.ts`
- Create: `apps/api/src/contexts/users/application/use-cases/update-user.use-case.spec.ts`
- Create: `apps/api/src/contexts/users/application/use-cases/remove-user.use-case.ts`
- Create: `apps/api/src/contexts/users/application/use-cases/remove-user.use-case.spec.ts`
- Create: `apps/api/src/contexts/users/application/testing/in-memory-user.repository.ts`

- [ ] **Step 1: Create an in-memory repository implementing the port**

```ts
export class InMemoryUserRepository implements UserRepositoryPort {
  constructor(readonly users: User[] = []) {}

  async findById(id: string): Promise<User | null> {
    return this.users.find((user) => user.props.id === id) ?? null;
  }

  // Implement list, updateName, and remove with the same observable semantics
  // as the existing UsersService, including pagination and case-insensitive q.
}
```

Replace the explanatory comment with the complete four methods before saving.

- [ ] **Step 2: Write failing use-case tests**

Each use case gets success and failure cases. Example:

```ts
it("throws UserNotFoundError for an unknown id", async () => {
  const repo = new InMemoryUserRepository();
  const useCase = new FindUserUseCase(repo);

  await expect(useCase.execute("missing")).rejects.toBeInstanceOf(
    UserNotFoundError,
  );
});
```

- [ ] **Step 3: Implement minimal use cases**

```ts
export class FindUserUseCase {
  constructor(private readonly users: UserRepositoryPort) {}

  async execute(id: string): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) throw new UserNotFoundError(id);
    return user;
  }
}
```

Implement list, update, and remove with the same error semantics expected by the
current HTTP adapter.

- [ ] **Step 4: Run application tests**

```bash
pnpm --filter @ai-padrao/api test src/contexts/users/application
```

Expected: PASS without NestJS or Prisma initialization.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/contexts/users/application
git commit -m "feat(api): add users application use cases" -m "Task: 6"
```

---

### Task 7: Add the Prisma users adapter and mapper

**Files:**

- Create: `apps/api/src/contexts/users/infrastructure/prisma/prisma-user.mapper.ts`
- Create: `apps/api/src/contexts/users/infrastructure/prisma/prisma-user.mapper.spec.ts`
- Create: `apps/api/src/contexts/users/infrastructure/prisma/prisma-user.repository.ts`
- Create: `apps/api/src/contexts/users/infrastructure/prisma/prisma-user.repository.spec.ts`

- [ ] **Step 1: Write mapper round-trip tests**

Use a representative Prisma user record and assert domain conversion plus public
DTO conversion. Explicitly assert role mapping and dates.

- [ ] **Step 2: Implement the mapper**

```ts
export const PrismaUserMapper = {
  toDomain(record: PrismaUser): User {
    return new User({
      id: record.id,
      email: Email.create(record.email),
      name: Name.create(record.name),
      role: record.role,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  },
};
```

`PrismaUser` is imported only in this infrastructure file.

- [ ] **Step 3: Write repository tests against a mocked PrismaService**

Assert exact `skip`, `take`, `orderBy`, `where`, update, and delete calls. Include
Prisma not-found translation to `null`/`false` as defined by the port.

- [ ] **Step 4: Implement the repository adapter**

Decorate only the adapter with `@Injectable()`. Inject `PrismaService` as a
runtime import, not `import type`, per ADR-002.

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @ai-padrao/api test src/contexts/users/infrastructure
pnpm --filter @ai-padrao/api lint
```

Expected: PASS; Prisma imports exist only under infrastructure.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/contexts/users/infrastructure
git commit -m "feat(api): add Prisma users repository adapter" -m "Task: 7"
```

---

### Task 8: Swap the users HTTP adapter and composition root

**Files:**

- Create: `apps/api/src/contexts/users/adapters/inbound/http/users.controller.ts`
- Create: `apps/api/src/contexts/users/adapters/inbound/http/users.controller.spec.ts`
- Move: `apps/api/src/modules/users/dto/users.dto.ts` → `apps/api/src/contexts/users/adapters/inbound/http/dto/users.dto.ts`
- Create: `apps/api/src/contexts/users/users.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Delete after verification: `apps/api/src/modules/users/`
- Verify: `apps/api/test/users.e2e-spec.ts`

- [ ] **Step 1: Write controller tests with mocked use cases**

Assert that DTOs are translated to application inputs and domain results are
translated to the exact existing response contract. Assert
`UserNotFoundError` becomes the same HTTP status currently returned.

- [ ] **Step 2: Implement the controller as a thin inbound adapter**

Keep all route decorators, guards, parameter names, and status decorators from
the current controller. Replace `UsersService` calls with the four use cases.

- [ ] **Step 3: Wire the module**

```ts
@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [
    PrismaUserRepository,
    { provide: USER_REPOSITORY, useExisting: PrismaUserRepository },
    {
      provide: ListUsersUseCase,
      useFactory: (repo: UserRepositoryPort) => new ListUsersUseCase(repo),
      inject: [USER_REPOSITORY],
    },
    // Repeat explicit factories for find, update, and remove.
  ],
  exports: [USER_REPOSITORY],
})
export class UsersModule {}
```

Replace the comment with all four providers before saving.

- [ ] **Step 4: Swap `AppModule` to the context module**

Change only the users import. Do not leave both controllers active.

- [ ] **Step 5: Run unit and users e2e tests**

```bash
pnpm --filter @ai-padrao/api test src/contexts/users
pnpm --filter @ai-padrao/api test:e2e -- users.e2e-spec.ts
pnpm --filter @ai-padrao/api typecheck
```

Expected: all existing routes and response shapes pass unchanged.

- [ ] **Step 6: Remove the legacy users module and run the full API suite**

```bash
pnpm --filter @ai-padrao/api test
pnpm --filter @ai-padrao/api test:e2e
```

Expected: PASS; no source import references `src/modules/users`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src apps/api/test
git commit -m "refactor(api): migrate users to a hexagonal context" -m "Task: 8"
```

---

### Task 9: Build auth ports and application use cases

**Files:**

- Create: `apps/api/src/contexts/auth/domain/errors/auth.errors.ts`
- Create: `apps/api/src/contexts/auth/domain/value-objects/token-ttl.ts`
- Create: `apps/api/src/contexts/auth/domain/value-objects/token-ttl.spec.ts`
- Create: `apps/api/src/contexts/auth/domain/ports/access-token-issuer.port.ts`
- Create: `apps/api/src/contexts/auth/domain/ports/password-hasher.port.ts`
- Create: `apps/api/src/contexts/auth/domain/ports/refresh-token-store.port.ts`
- Create: `apps/api/src/contexts/auth/domain/ports/token-generator.port.ts`
- Create: `apps/api/src/contexts/auth/domain/ports/user-auth-repository.port.ts`
- Create: four use cases and four co-located specs under `apps/api/src/contexts/auth/application/use-cases/`
- Create: deterministic fakes under `apps/api/src/contexts/auth/application/testing/`

- [ ] **Step 1: Define framework-free ports**

```ts
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "USER";
  passwordHash: string;
}

export interface UserAuthRepositoryPort {
  findByEmail(email: string): Promise<AuthUser | null>;
  findById(id: string): Promise<AuthUser | null>;
  create(input: {
    email: string;
    name: string;
    passwordHash: string;
  }): Promise<AuthUser>;
}

export interface PasswordHasherPort {
  hash(value: string): Promise<string>;
  verify(hash: string, value: string): Promise<boolean>;
}

export interface AccessTokenIssuerPort {
  issue(claims: { sub: string; email: string; role: string }): Promise<string>;
}

export interface TokenGeneratorPort {
  generate(): string;
  hash(value: string): string;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface RefreshTokenStorePort {
  create(input: Omit<RefreshTokenRecord, "id" | "revokedAt">): Promise<void>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revoke(id: string): Promise<void>;
  revokeByHash(tokenHash: string): Promise<void>;
}
```

- [ ] **Step 2: Test TTL parsing using current defaults and accepted suffixes**

Copy the current `parseTtl` behavior exactly. Test seconds, minutes, hours, days,
and invalid configuration without changing environment names.

- [ ] **Step 3: Write RED tests for register and login**

Cover duplicate email, invalid credentials for both missing-user and wrong-hash
branches, successful password hashing, user creation, JWT claims, refresh-token
hash persistence, and returned response shape.

- [ ] **Step 4: Write RED tests for refresh and logout**

Cover missing, revoked, expired, and valid refresh records; assert rotation revokes
the old token before storing the new one. Cover idempotent/current logout behavior
exactly as characterized in Task 3.

- [ ] **Step 5: Implement minimal use cases**

Use constructor-injected interfaces. Do not add Nest decorators or Prisma imports.
Use the existing clock behavior, or inject `now: () => Date` if tests require
expiration determinism.

- [ ] **Step 6: Run auth inner-layer tests and lint**

```bash
pnpm --filter @ai-padrao/api test src/contexts/auth/domain
pnpm --filter @ai-padrao/api test src/contexts/auth/application
pnpm --filter @ai-padrao/api lint
```

Expected: PASS with no forbidden imports.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/contexts/auth/domain apps/api/src/contexts/auth/application
git commit -m "feat(api): add auth ports and application use cases" -m "Task: 9"
```

---

### Task 10: Implement auth infrastructure adapters

**Files:**

- Create adapter and spec pairs under `apps/api/src/contexts/auth/infrastructure/adapters/` for Argon2, JWT, token generation, refresh-token Prisma storage, and auth-user Prisma access

- [ ] **Step 1: Write Argon2 adapter round-trip tests**

Hash a deterministic password, verify it succeeds for the original value, and
fails for a different value. Use the existing Argon2 configuration.

- [ ] **Step 2: Implement `Argon2PasswordHasherAdapter`**

The adapter alone imports `argon2` and implements `PasswordHasherPort`.

- [ ] **Step 3: Write JWT claims tests**

Instantiate the adapter with the existing `JwtService` configuration. Decode the
result and assert `sub`, `email`, `role`, and current expiry semantics.

- [ ] **Step 4: Implement `JwtAccessTokenIssuerAdapter`**

The adapter alone imports Nest JWT infrastructure.

- [ ] **Step 5: Test and implement token generation/hash**

Use Node `crypto.randomBytes` for opaque refresh values and SHA-256 for hashes,
matching current behavior.

- [ ] **Step 6: Test and implement Prisma adapters**

Mock `PrismaService` and assert exact create/find/revoke calls and Prisma-to-port
mapping. Keep all Prisma imports below `infrastructure/`.

- [ ] **Step 7: Run adapter tests**

```bash
pnpm --filter @ai-padrao/api test src/contexts/auth/infrastructure
pnpm --filter @ai-padrao/api lint
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/contexts/auth/infrastructure
git commit -m "feat(api): add auth infrastructure adapters" -m "Task: 10"
```

---

### Task 11: Swap the auth HTTP adapter and composition root

**Files:**

- Create: `apps/api/src/contexts/auth/adapters/inbound/http/auth.controller.ts`
- Create: `apps/api/src/contexts/auth/adapters/inbound/http/auth.controller.spec.ts`
- Move: existing auth DTO and JWT strategy into the context inbound adapter
- Create: `apps/api/src/contexts/auth/auth.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Delete after verification: `apps/api/src/modules/auth/`
- Verify: `apps/api/test/auth.e2e-spec.ts`

- [ ] **Step 1: Write controller tests around existing contracts**

Assert all current routes, `@Public()` placement, status codes, response bodies,
refresh-cookie options, logout behavior, and application-error mapping.

- [ ] **Step 2: Implement the thin controller**

Copy transport decorators and cookie behavior exactly from the current controller.
Translate inputs to use cases and outputs/errors back to HTTP. Do not put hashing,
Prisma, JWT signing, or token rotation in the controller.

- [ ] **Step 3: Move and test the JWT strategy**

Keep the current payload and returned user identity shape. The strategy is an
inbound authentication adapter, not domain code.

- [ ] **Step 4: Wire every port explicitly in `AuthModule`**

Use symbols as provider tokens and `useFactory` for plain use-case classes. Do
not use `import type` for classes Nest must resolve at runtime.

- [ ] **Step 5: Swap `AppModule` and run auth e2e**

```bash
pnpm --filter @ai-padrao/api test src/contexts/auth
pnpm --filter @ai-padrao/api test:e2e -- auth.e2e-spec.ts
pnpm --filter @ai-padrao/api typecheck
```

Expected: registration, login, refresh rotation, logout, guards, and cookie
behavior remain unchanged.

- [ ] **Step 6: Remove the legacy auth module and run full validation**

```bash
pnpm --filter @ai-padrao/api test
pnpm --filter @ai-padrao/api test:e2e
pnpm --filter @ai-padrao/api lint
pnpm --filter @ai-padrao/api typecheck
```

Expected: PASS and no source import references `src/modules/auth`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src apps/api/test
git commit -m "refactor(api): migrate auth to a hexagonal context" -m "Task: 11"
```

---

### Task 12: Migrate web auth to ports and adapters

**Files:**

- Create all files under `apps/web/src/features/auth/` shown in the target tree
- Modify: `apps/web/src/lib/auth.ts`
- Modify: `apps/web/src/lib/api-client.ts`
- Modify: `apps/web/src/middleware.ts`
- Modify: login/register App Router pages only to update imports/composition
- Delete after verification: `apps/web/src/components/login-form.tsx`
- Delete after verification: `apps/web/src/components/register-form.tsx`

- [ ] **Step 1: Define framework-free ports**

```ts
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthApiPort {
  login(input: LoginInput): Promise<AuthTokens>;
  register(input: RegisterInput): Promise<AuthTokens>;
  refresh(refreshToken: string): Promise<AuthTokens | null>;
  logout(refreshToken: string): Promise<void>;
}

export interface AuthCookieStorePort {
  getAccessToken(): string | undefined;
  getRefreshToken(): string | undefined;
  setTokens(tokens: AuthTokens): void;
  clearTokens(): void;
}

export interface AuthNavigationPort {
  dashboard(): never;
  login(error?: string): never;
  register(error?: string): never;
}
```

Use type-only contract imports in framework-free files because these types are
not Nest DI metadata.

- [ ] **Step 2: Write RED use-case tests with fakes**

Cover login/register success and failure, refresh success/failure, logout with
and without a token, cookie writes/clears, and navigation. Use no React, Next.js,
or real HTTP in these tests.

- [ ] **Step 3: Implement minimal application use cases**

Use constructor-injected ports and preserve current error query parameters and
redirect destinations.

- [ ] **Step 4: Test and implement infrastructure adapters**

`FetchAuthApiAdapter` owns `fetch`; `NextAuthCookieStoreAdapter` owns
`next/headers`; `NextAuthNavigationAdapter` owns `next/navigation`. Assert exact
HTTP methods, credentials, cookie names/options, and routes already in use.

- [ ] **Step 5: Move forms as presentation adapters**

Keep markup, accessibility, schemas, and visible error behavior unchanged.
Forms call a composed action/use case and do not import concrete HTTP/cookie
adapters directly.

- [ ] **Step 6: Refactor server actions and API client into composition roots**

`src/lib/auth.ts` instantiates adapters and delegates to use cases. The API
client delegates refresh behavior through `AuthApiPort` and retains its
single-refresh concurrency behavior.

- [ ] **Step 7: Refactor middleware without changing its required location**

Keep `apps/web/src/middleware.ts` and its matcher. Extract pure decision logic
into the auth application layer or a framework-neutral helper, then let
middleware translate the decision to `NextResponse`.

- [ ] **Step 8: Run web tests and checks**

```bash
pnpm --filter @ai-padrao/web test
pnpm --filter @ai-padrao/web lint
pnpm --filter @ai-padrao/web typecheck
pnpm --filter @ai-padrao/web build
```

Expected: all existing routes and user-visible auth behavior pass unchanged.

- [ ] **Step 9: Remove legacy form files and verify no stale imports**

Run the same four commands after deletion.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src
git commit -m "refactor(web): migrate auth to ports and adapters" -m "Task: 12"
```

---

### Task 13: Enforce independent 80% coverage gates

**Files:**

- Modify: `apps/api/jest.config.ts`
- Modify: `apps/api/package.json`
- Modify: `apps/web/vitest.config.ts`
- Modify: `apps/web/package.json`
- Modify: root `package.json`
- Modify: `turbo.json` only if the new task/output needs declaration

- [ ] **Step 1: Configure the API gate**

Add explicit source collection and thresholds:

```ts
collectCoverageFrom: [
  '**/*.ts',
  '!**/*.spec.ts',
  '!**/*.d.ts',
  '!main.ts',
  '!**/*.module.ts',
],
coverageThreshold: {
  global: {
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80,
  },
},
```

Review each exclusion: `*.module.ts` may remain excluded only while it contains
composition wiring and no conditional/business behavior.

- [ ] **Step 2: Replace the API baseline script**

```json
"test:coverage": "jest --coverage"
```

Delete `test:coverage:baseline`.

- [ ] **Step 3: Configure the web gate**

```ts
coverage: {
  provider: 'v8',
  include: ['src/**/*.{ts,tsx}'],
  exclude: [
    'src/**/*.d.ts',
    'src/**/*.spec.{ts,tsx}',
    'src/app/layout.tsx',
    'src/app/providers.tsx',
  ],
  thresholds: {
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80,
  },
},
```

Do not exclude middleware, forms, pages with behavior, adapters, or use cases.
If shell files gain behavior, remove their exclusion and test them.

- [ ] **Step 4: Replace the web baseline script**

```json
"test:coverage": "VITE_CJS_IGNORE_WARNING=true vitest run --coverage"
```

Delete `test:coverage:baseline`.

- [ ] **Step 5: Add the aggregate root command**

Use workspace filtering so contracts/packages cannot mask either app:

```json
"test:coverage": "pnpm --filter @ai-padrao/api test:coverage && pnpm --filter @ai-padrao/web test:coverage"
```

- [ ] **Step 6: Run each gate independently**

```bash
pnpm --filter @ai-padrao/api test:coverage
pnpm --filter @ai-padrao/web test:coverage
```

Expected: both commands report statements, branches, functions, and lines at
or above 80%. If any metric fails, add meaningful tests for the reported
uncovered code, rerun, and do not modify thresholds/exclusions.

- [ ] **Step 7: Prove failure semantics**

Temporarily set one threshold to 101, run that app command and the root command,
and confirm both fail. Restore 80 immediately and rerun both successfully.

- [ ] **Step 8: Run the aggregate gate**

```bash
pnpm test:coverage
```

Expected: PASS only after both app commands pass independently.

- [ ] **Step 9: Commit**

```bash
git add package.json turbo.json apps/api/jest.config.ts apps/api/package.json apps/web/vitest.config.ts apps/web/package.json
git commit -m "test(root): enforce 80 percent coverage per app and metric" -m "Task: 13"
```

---

### Task 14: Integrate the gate and document the final architecture

**Files:**

- Modify: the repository's existing CI workflow file that runs build/test
- Modify: `CONTRIBUTING.md`
- Modify: `ARCHITECTURE.md`
- Create: `docs/decisions/ADR-012-vertical-bounded-contexts.md`
- Create: `docs/decisions/ADR-013-independent-80-percent-coverage.md`
- Modify: `docs/decisions/README.md`
- Modify: `.openspec/changes/ddd-hexagonal-coverage/tasks.md`

- [ ] **Step 1: Add the aggregate gate to CI**

Insert `pnpm test:coverage` after dependency installation/typecheck and before
build or merge completion. Do not duplicate it in `prebuild` if CI already runs
it explicitly; avoid running full coverage twice in one pipeline.

- [ ] **Step 2: Update contributor validation commands**

Add `pnpm test:coverage` to the Definition of Done and state the four independent
80% thresholds.

- [ ] **Step 3: Update `ARCHITECTURE.md` to the implemented state**

Document vertical contexts, layer responsibilities, inward dependency direction,
composition roots, Prisma mappings, web ports/adapters, and the actual migrated
paths. Do not describe files that were not implemented.

- [ ] **Step 4: Record proactive architecture decisions**

Each ADR uses Context, Decision, Consequences, and Enforcement. Mark them as
proactive architecture decisions with no fabricated INC reference:

```markdown
- **Status:** Accepted
- **Date:** 2026-08-04
- **Decision type:** Proactive architecture decision
```

ADR-012 records vertical bounded contexts and inward dependencies. ADR-013
records independent 80% thresholds across all four metrics.

- [ ] **Step 5: Update the ADR index and OpenSpec checklist**

List ADR-012 and ADR-013, update the count, and check only tasks whose commands
have passed.

- [ ] **Step 6: Run the complete Definition of Done**

```bash
pnpm harness:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
```

Expected: every command passes, no tests are skipped, and each app reports all
four metrics at or above 80%.

- [ ] **Step 7: Commit**

```bash
git add .github CONTRIBUTING.md ARCHITECTURE.md docs/decisions .openspec/changes/ddd-hexagonal-coverage/tasks.md
git commit -m "docs(sdd): document hexagonal contexts and coverage enforcement" -m "Task: 14"
```

---

### Task 15: Post-merge OpenSpec archival

**Files:**

- Create: `.openspec/specs/architecture/ddd-hexagonal-coverage.md`
- Modify: `.openspec/CHANGELOG.md`
- Delete: `.openspec/changes/ddd-hexagonal-coverage/`

Run this task only after the implementation is reviewed and merged, following
`.openspec/AGENTS.md` section 5.

- [ ] **Step 1: Move the approved spec delta into the canonical specs tree**

Preserve the final verified requirements and scenarios.

- [ ] **Step 2: Append a changelog entry**

Record the migration, app-specific 80% gates, and the final merge/commit
reference.

- [ ] **Step 3: Remove the completed change folder**

Ensure no information exists only in the deleted folder; design history remains
in the canonical spec, ADRs, and this implementation plan.

- [ ] **Step 4: Validate archival**

```bash
pnpm harness:check
git status --short
```

Expected: harness passes; status shows only the canonical spec, changelog, and
change-folder deletion.

- [ ] **Step 5: Commit**

```bash
git add .openspec
git commit -m "docs(sdd): archive DDD hexagonal coverage change" -m "Task: 15"
```

---

## Final compatibility checklist

- [ ] API methods, paths, status codes, and response schemas are unchanged.
- [ ] `@Public()` remains on health and public auth endpoints.
- [ ] JWT claims and TTL defaults are unchanged.
- [ ] Refresh-token rotation and revocation behavior are unchanged.
- [ ] Cookie names and security options are unchanged unless separately approved.
- [ ] Prisma schema and migrations are unchanged.
- [ ] Web routes and middleware matcher are unchanged.
- [ ] No token uses `localStorage` or `sessionStorage`.
- [ ] Domain/application files contain no forbidden framework/infrastructure imports.
- [ ] API reports at least 80% for all four metrics.
- [ ] Web reports at least 80% for all four metrics.
- [ ] `pnpm harness:check`, lint, typecheck, tests, coverage, and build all pass.

## Plan self-review

**Spec coverage:** Tasks 4–12 implement vertical contexts, ports/adapters,
framework-independent inner layers, incremental `users`/`auth` migration, and
contract preservation. Tasks 2, 3, and 13 implement honest coverage measurement,
meaningful tests, and four independent 80% gates. Tasks 1, 14, and 15 cover SDD,
ADRs, CI, documentation, and archival.

**Placeholder scan:** No `TBD`, `TODO`, “implement later,” skipped test, or
unspecified threshold remains. Steps that require copying an existing contract
explicitly identify the source and prohibit behavior changes.

**Type consistency:** API users use `UserRepositoryPort` throughout. API auth
uses `UserAuthRepositoryPort`, `PasswordHasherPort`, `AccessTokenIssuerPort`,
`TokenGeneratorPort`, and `RefreshTokenStorePort`. Web auth consistently uses
`AuthApiPort`, `AuthCookieStorePort`, and `AuthNavigationPort`. Provider symbols
are defined beside their ports and used only by composition roots.
