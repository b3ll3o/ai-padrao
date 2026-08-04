# Project Documentation Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile all project documentation to reflect post-stabilization state, and add 11 ADRs + `CONTRIBUTING.md` + `ARCHITECTURE.md` per the approved design spec ([spec link](../specs/2026-08-04-project-documentation-audit-design.md)).

**Architecture:** Six independent doc-edit clusters — (A) in-place fixes to `CLAUDE.md`/`README.md`/`.harness/README.md`; (B) 12 new files under `docs/decisions/`; (C) 2 new top-level docs. Each cluster ends in self-contained commits. No source-code changes. The harness self-verifies at the end (`pnpm harness:check`).

**Tech Stack:** Markdown, Git, Conventional Commits, pnpm.

---

## Task 1: Capture baseline numbers and existing INC list

**Files:**

- Read: `.harness/INCIDENTS.md`
- Read: `.harness/check.sh`

- [ ] **Step 1: Run harness check to capture exact PASS/SKIP counts**

Run:

```bash
pnpm harness:check 2>&1 | tail -5
```

Expected output (last 5 lines): a summary line in the form `PASS: X  FAIL: Y  SKIP: Z`. Save the actual values for use in Tasks 4 and 5.

- [ ] **Step 2: Count INC entries in `.harness/INCIDENTS.md`**

Run:

```bash
grep -cE "^## INC-[0-9]{3}" .harness/INCIDENTS.md
```

Expected: `16`. If different, stop and report — the ADR list in the spec assumes 16.

- [ ] **Step 3: List all INC labels in `.harness/check.sh`**

Run:

```bash
grep -E "^# INC-[0-9]{3}" .harness/check.sh | wc -l
```

Expected: `14` (the count of named auto-checks; INC-003 and INC-010 are manual).

- [ ] **Step 4: Record the captured numbers in a working note**

Open `docs/superpowers/specs/2026-08-04-project-documentation-audit-design.md` mentally and remember:

- `"PASS" count` (from Step 1, last line)
- `"SKIP" count` (from Step 1, last line)
- Total INC count: 16
- Auto-checked count: 14
- Manual count: 2 (INC-003, INC-010)

These four numbers are the only numerical inputs the rest of the plan needs.

- [ ] **Step 5: Commit (no file changes, this task only captures context)**

Skip the commit — this task has no file changes.

---

## Task 2: Create `docs/decisions/` directory and index README

**Files:**

- Create: `docs/decisions/README.md`

- [ ] **Step 1: Write the index `docs/decisions/README.md`**

Write this exact content to `docs/decisions/README.md` (use the `Write` tool):

```markdown
# Architecture Decision Records

This directory captures the project-specific decisions that any AI assistant or
human contributor must respect when modifying this codebase. Each ADR is short,
Nygard-formatted, and links back to a real incident in `.harness/INCIDENTS.md`.

## How to read these

1. Skim the list below to know which ADRs exist.
2. When you are about to touch a related area, open the matching ADR.
3. The "Enforcement" section of each ADR tells you what auto-check will fail
   if you violate the rule (the harness runs the check on every build).

Each ADR has four sections: **Context**, **Decision**, **Consequences**,
**Enforcement**. Conventions: `Status: Accepted`, `Date: 2026-08-04` for all
ADRs in this initial set.

## Index (11 ADRs)

| ADR                                                          | Title                                                   | Incident | Tag                             |
| ------------------------------------------------------------ | ------------------------------------------------------- | -------- | ------------------------------- |
| [ADR-001](ADR-001-fastify-reply-api.md)                      | Use Fastify reply API, not Node ServerResponse API      | INC-002  | nestjs-fastify-gotchas          |
| [ADR-002](ADR-002-no-import-type-for-nest-di.md)             | Don't `import type` NestJS DI'd services                | INC-003  | nestjs-fastify-gotchas          |
| [ADR-003](ADR-003-public-decorator-on-health-auth.md)        | `@Public()` required on health/auth endpoints           | INC-005  | nestjs-fastify-gotchas          |
| [ADR-004](ADR-004-dockerfile-copy-schema-before-generate.md) | Dockerfile: copy prisma schema BEFORE `prisma generate` | INC-006  | pnpm-monorepo-script            |
| [ADR-005](ADR-005-non-default-ports.md)                      | Non-default host ports in `docker-compose.yml`          | INC-008  | pnpm-monorepo-script            |
| [ADR-006](ADR-006-nest-logger-not-console.md)                | Use Nest `Logger`, not `console.*` in `main.ts`         | INC-009  | nestjs-fastify-gotchas          |
| [ADR-007](ADR-007-no-skipped-tests.md)                       | Zero tolerance: no skipped/todo/`--passWithNoTests`     | INC-012  | AGENTS.md §No skipped tests     |
| [ADR-008](ADR-008-capture-scripts-bash-and-python3-only.md)  | Capture scripts use bash + python3 only                 | INC-013  | AGENTS.md §Capture deps         |
| [ADR-009](ADR-009-events-directory-is-gitignored.md)         | `.harness/events/` is gitignored (session state)        | INC-014  | AGENTS.md §Events transient     |
| [ADR-010](ADR-010-daily-digest-freshness.md)                 | Daily digest must be fresh (< 25h old)                  | INC-015  | AGENTS.md §Digest freshness     |
| [ADR-011](ADR-011-no-plaintext-secrets-in-source.md)         | No plaintext tokens in source                           | INC-016  | AGENTS.md §No plaintext secrets |

## The three highest-traffic ADRs

If you are an AI assistant and read only three ADRs, read:

1. **ADR-007 — No skipped tests.** Triggered every time someone writes a test.
2. **ADR-002 — Don't `import type` for Nest DI.** Triggered every time someone
   refactors imports under `apps/api/`.
3. **ADR-006 — Use Nest Logger, not console.*** Triggered every time someone
   edits `apps/api/src/main.ts`.

## When to add a new ADR

After fixing a bug and adding an entry to `.harness/INCIDENTS.md`, ask: "is
this pattern likely to recur?" If yes, draft an ADR alongside the INC entry.
Add the file under `docs/decisions/`, list it in the Index table above, and
link the new INC from the ADR.
```

- [ ] **Step 2: Verify the file exists**

Run:

```bash
test -f docs/decisions/README.md && wc -l docs/decisions/README.md
```

Expected: a positive line count (≥ 30). The number "11" should appear in the index.

- [ ] **Step 3: Commit**

```bash
git add docs/decisions/README.md
git commit -m "docs(sdd): add architecture-decision-records index

Sets the schema and listing for 11 ADRs covering INC-002, INC-003,
INC-005, INC-006, INC-008, INC-009, INC-012..INC-016. Following tasks
write each ADR file under this directory.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Create ADRs 001-004 (Nest+Fastify gotchas + Dockerfile ordering)

**Files:**

- Create: `docs/decisions/ADR-001-fastify-reply-api.md`
- Create: `docs/decisions/ADR-002-no-import-type-for-nest-di.md`
- Create: `docs/decisions/ADR-003-public-decorator-on-health-auth.md`
- Create: `docs/decisions/ADR-004-dockerfile-copy-schema-before-generate.md`

- [ ] **Step 1: Create `docs/decisions/ADR-001-fastify-reply-api.md`**

Use the `Write` tool with this exact content:

```markdown
# ADR-001 — Use Fastify reply API, not Node ServerResponse API

- **Status:** Accepted
- **Date:** 2026-08-04
- **Incident reference:** INC-002 (full context in `.harness/INCIDENTS.md`)

## Context

In NestJS under `FastifyAdapter`, `context.switchToHttp().getResponse()`
returns a Fastify `FastifyReply`, not a Node `http.ServerResponse`. Writing
interceptors/middleware/decorators that call Node response methods
(`res.setHeader`, `res.cookie`, `res.send`) compiles cleanly, passes unit
tests that mock the response, and explodes at runtime with "is not a
function" errors — once real traffic hits.

## Decision

In any file under `apps/api/src/` that obtains an HTTP response from a
NestJS execution context, use Fastify's `reply.header(name, value)` and
`reply.send(payload)` APIs. Type the response as `FastifyReply` (import
from `fastify`) and document any cross-API call.

A quick mental rule: if the variable was named `res`, rename it to `reply`
and switch every method to the Fastify equivalent.

## Consequences

- **Easier:** Interceptors and guards compile against the actual response
  shape; failures surface at type-check time, not runtime.
- **Harder:** Patterns borrowed from Express middleware need manual translation.
- **Trade-off:** Accept — the alternative (silently wrong at runtime) is
  strictly worse; we already lived it.

## Enforcement

- Auto-check **INC-002** in `.harness/check.sh` greps
  `apps/api/src/**` for `setHeader|res\.cookie|res\.json(` (with
  command-specific exclusions) and fails the build on any match.
- Skill: `nestjs-fastify-gotchas` Gotcha 2.
- Codemod: `.harness/codemods/inc-002-fastify-response.py` rewrites the
  forbidden patterns to their Fastify equivalent (use
  `pnpm harness:codemod inc-002-fastify-response --check <file>` to see the
  proposal before applying).
```

- [ ] **Step 2: Create `docs/decisions/ADR-002-no-import-type-for-nest-di.md`**

Write this exact content:

````markdown
# ADR-002 — Don't `import type` NestJS DI'd services

- **Status:** Accepted
- **Date:** 2026-08-04
- **Incident reference:** INC-003 (full context in `.harness/INCIDENTS.md`)

## Context

NestJS relies on `emitDecoratorMetadata: true` to emit `design:paramtypes`
references for constructor parameters. The emitted JavaScript references
the import _value_ at runtime. TypeScript's `import type { Foo }` syntax
erases the value from the emitted JS, substituting `Object` for the type
slot. The NestJS DI container then cannot resolve the provider, surfacing
a cryptic "Nest can't resolve dependencies of the XService (?)" error
on first boot.

`@typescript-eslint/consistent-type-imports` is correct for most code —
but the auto-fix doesn't know about the framework boundary, and silently
breaks every DI'd service in the codebase on `pnpm lint --fix`.

## Decision

In any file under `apps/api/src/modules/**` that exports a NestJS class
(controller, service, guard, interceptor, strategy, decorator), DI'd
service imports MUST be runtime values:

```ts
import { PrismaService } from "../prisma/prisma.service"; // runtime value
import type { SomeType } from "../types"; // pure type only
```
````

The eslint rule is correct in spirit but wrong here. Suppress it on
relevant lines with `// eslint-disable-next-line @typescript-eslint/consistent-type-imports`.

## Consequences

- **Easier:** DI continues to work; `pnpm lint --fix` is safe.
- **Harder:** Splitting imports by usage is a small cost.
- **Trade-off:** Accept — the alternative (a global eslint exemption) would
  defeat the lint rule for everyone.

## Enforcement

- Skill: `nestjs-fastify-gotchas` Gotcha 1.
- Codemod: `.harness/codemods/inc-003-nest-di-imports.py` audits DI'd
  files and surfaces offending imports.
- Auto-check **INC-003** is documented but **manual** (it would require a
  TypeScript-aware rule that knows framework boundaries); review by hand.

````

- [ ] **Step 3: Create `docs/decisions/ADR-003-public-decorator-on-health-auth.md`**

Write this exact content:

```markdown
# ADR-003 — `@Public()` required on health/auth endpoints

- **Status:** Accepted
- **Date:** 2026-08-04
- **Incident reference:** INC-005 (full context in `.harness/INCIDENTS.md`)

## Context

We register `JwtAuthGuard` globally via `APP_GUARD` so every endpoint is
authenticated by default. Without an explicit opt-out, infra-level
endpoints (`/api/health`, login, register, refresh) are also auth-gated.
Health probes (Kubernetes liveness, Docker `HEALTHCHECK`, monitoring
agents) carry no JWT — they expect a 200. A globally-guarded health
endpoint returns 401 and marks the pod unhealthy, causing restart loops.

## Decision

Endpoints that must be reachable without authentication MUST carry the
`@Public()` decorator at the class level:

```ts
@Public()
@ApiTags('health')
@Controller('health')
export class HealthController { /* ... */ }
````

Required: `health`, `auth/login`, `auth/register`, `auth/refresh`. No
exceptions. Endpoint-local overrides are not supported — `@Public()` is
class-level only.

## Consequences

- **Easier:** Health probes work; users can authenticate.
- **Harder:** A new unauthenticated endpoint requires remembering the
  decorator (mitigated by the auto-check below).
- **Trade-off:** Accept — the alternative is operational breakage that
  is hard to attribute to a missing decorator.

## Enforcement

- Auto-check **INC-005** in `.harness/check.sh` greps
  `apps/api/src/modules/health/health.controller.ts` for `@Public()` and
  fails the build if missing.
- Skill: `nestjs-fastify-gotchas` Gotcha 4.
- E2E test: `apps/api/test/health.e2e-spec.ts` hits `/api/health` without
  a token and expects 200.

````

- [ ] **Step 4: Create `docs/decisions/ADR-004-dockerfile-copy-schema-before-generate.md`**

Write this exact content:

```markdown
# ADR-004 — Dockerfile: copy prisma schema BEFORE `prisma generate`

- **Status:** Accepted
- **Date:** 2026-08-04
- **Incident reference:** INC-006 (full context in `.harness/INCIDENTS.md`)

## Context

`prisma generate` reads `apps/api/prisma/schema.prisma` from the build
context. If the `COPY apps/api ./apps/api` line comes AFTER the
`RUN pnpm --filter … exec prisma generate` line, the schema is not in
the image at generate-time. The error is loud on a clean rebuild:
"Could not find Prisma Schema that is required for this command" — but
often missed because CI cached layers from a previous successful build,
and the running container starts up just fine.

## Decision

The Dockerfile for any service that runs `prisma generate` during the
build MUST place the schema in the build context BEFORE the generate
step. The canonical shape:

```dockerfile
COPY apps/api/prisma ./apps/api/prisma    # schema first
RUN pnpm --filter @ai-padrao/api exec prisma generate
COPY apps/api ./apps/api                  # rest of the app
````

For new Dockerfiles, follow this exact ordering. For existing ones, the
auto-check below will surface the bug.

## Consequences

- **Easier:** Cold-cache builds work; image rebuilds from a clean state
  succeed.
- **Harder:** Slightly larger intermediate layer (the schema copy adds
  ~10 KB). Negligible.
- **Trade-off:** Accept — zero-cost fix for a build-breaker.

## Enforcement

- Auto-check **INC-006** in `.harness/check.sh` parses the Dockerfile
  AST and verifies the order of `COPY apps/api/prisma` vs
  `prisma generate`.
- Skill: `pnpm-monorepo-script-pitfalls` Pitfall 4.
- Codemod: `.harness/codemods/inc-006-dockerfile-order.py` proposes the
  reorder for any offending file.

````

- [ ] **Step 5: Verify all four files exist**

Run:
```bash
ls -1 docs/decisions/ADR-00[1-4]*.md
````

Expected: four filenames printed, in order.

- [ ] **Step 6: Commit**

```bash
git add docs/decisions/ADR-001-fastify-reply-api.md \
        docs/decisions/ADR-002-no-import-type-for-nest-di.md \
        docs/decisions/ADR-003-public-decorator-on-health-auth.md \
        docs/decisions/ADR-004-dockerfile-copy-schema-before-generate.md
git commit -m "docs(sdd): add ADRs 001-004 (Nest+Fastify + Dockerfile)

ADR-001 INC-002 Fastify reply API
ADR-002 INC-003 import type in Nest DI
ADR-003 INC-005 @Public() on health/auth
ADR-004 INC-006 Dockerfile ordering

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Create ADRs 005-008 (port policy, Nest Logger, no-skip-tests, capture deps)

**Files:**

- Create: `docs/decisions/ADR-005-non-default-ports.md`
- Create: `docs/decisions/ADR-006-nest-logger-not-console.md`
- Create: `docs/decisions/ADR-007-no-skipped-tests.md`
- Create: `docs/decisions/ADR-008-capture-scripts-bash-and-python3-only.md`

- [ ] **Step 1: Create `docs/decisions/ADR-005-non-default-ports.md`**

Use the `Write` tool with this exact content:

```markdown
# ADR-005 — Non-default host ports in `docker-compose.yml`

- **Status:** Accepted
- **Date:** 2026-08-04
- **Incident reference:** INC-008 (full context in `.harness/INCIDENTS.md`)

## Context

Sister projects in `/home/leo/Documentos/projetos/` (notably `pedi-ai`)
hold the well-known dev ports: 1025 (SMTP), 8025 (MailHog UI). When our
`docker-compose.yml` binds the same host ports, the daemon refuses
to start with `Bind for 127.0.0.1:1025 failed: port is already allocated`.
The error doesn't say which other project owns the port — just that
"something" does.

## Decision

Avoid well-known default ports in `docker-compose.yml` for services
that are likely to coexist with sibling projects. Remap host-side
bindings while keeping container-internal ports unchanged (so internal
DNS and linked service env vars continue to resolve). The current
allowlist in use:

| Service      | Default host port | Project host port        |
| ------------ | ----------------- | ------------------------ |
| MailHog SMTP | 1025              | 11125                    |
| MailHog UI   | 8025              | 18025                    |
| Postgres     | 5432              | (only changed on demand) |
| Postgres dev | (varies)          | (only changed on demand) |

The rule applies to any new service port added to `docker-compose.yml`:
verify the proposed host port is not already a well-known dev-port and
not in use by a sibling project.

## Consequences

- **Easier:** Local multi-project stacks can run side-by-side without
  stopping one to start the other.
- **Harder:** A new engineer has to learn the project's port remap.
- **Trade-off:** Accept — the cost of the remap (a few numbers in the
  docs) is much smaller than the cost of "which project owns port 8025?".

## Enforcement

- Auto-check **INC-008** in `.harness/check.sh` parses
  `docker-compose.yml` and fails the build if a host binding uses a
  flagged default port.
- Skill: `pnpm-monorepo-script-pitfalls` Pitfall 5.
```

- [ ] **Step 2: Create `docs/decisions/ADR-006-nest-logger-not-console.md`**

Write this exact content:

````markdown
# ADR-006 — Use Nest `Logger`, not `console.*` in `main.ts`

- **Status:** Accepted
- **Date:** 2026-08-04
- **Incident reference:** INC-009 (full context in `.harness/INCIDENTS.md`)

## Context

`apps/api/src/main.ts` (the bootstrap file) starts Nest, listens on a
port, and announces readiness. The naive implementation uses
`console.log(\`listening on :${port}\`)`. ESLint's `no-console` rule
flags it. The lazy "fix" is `console.warn(\`listening on :${port}\`)`,
which silences the lint but redirects the banner from stdout to stderr,
breaking any pipeline that grepped stdout. The Nest startup banner
should go through the same structured logger as the rest of the app.

## Decision

In `apps/api/src/main.ts` (and any other application bootstrap file in
the workspace), use the Nest built-in `Logger`:

```ts
import { Logger } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, adapter, {
    bufferLogs: true,
  });
  await app.listen(port, "0.0.0.0");
  app.flushLogs();
  new Logger("Bootstrap").log(`listening on :${port}`);
}
```
````

Service-level code may use either the Nest `Logger` or a contextual
logger passed via DI. Direct `console.*` is reserved for test files
(`*.spec.ts`, `*.test.ts`) and the catch-all `redact.py` capture
script.

## Consequences

- **Easier:** All output goes through one structured channel (JSON by
  default with the right OTel/log-shipper config); grep pipelines
  don't change between stdout and stderr.
- **Harder:** Slightly more boilerplate at startup.
- **Trade-off:** Accept — observability consolidation is the goal.

## Enforcement

- Auto-check **INC-009** in `.harness/check.sh` greps
  `apps/api/src/main.ts` for `console\.(log|warn|error|info)` and fails
  the build on any match.
- Skill: `nestjs-fastify-gotchas` Gotcha 5 + 6.
- Codemod: `.harness/codemods/inc-009-nest-logger.py` rewrites the
  forbidden pattern to `Logger.log/warn/error`.

````

- [ ] **Step 3: Create `docs/decisions/ADR-007-no-skipped-tests.md`**

Write this exact content:

```markdown
# ADR-007 — Zero tolerance: no skipped/todo/`--passWithNoTests` tests

- **Status:** Accepted
- **Date:** 2026-08-04
- **Incident reference:** INC-012 (full context in `.harness/INCIDENTS.md`)

## Context

A green test run that "passes" by skipping, marking `todo`, or by being
absent entirely is a lie. It claims coverage while delivering zero
signal. The deceptive signal compounds: the more skips accumulate, the
more a green build stops being meaningful. We learned this the hard
way during stabilization (INC-005 — health endpoint 401'd because no
test had ever called it without a token).

## Decision

The repo MUST NOT contain any skipped, disabled, or stubbed test. The
canonical list of forbidden patterns, in scope across all `apps/` and
`packages/`:

| Pattern                                         | Examples                                                          |
| ----------------------------------------------- | ----------------------------------------------------------------- |
| Jest/Vitest `.skip()`                           | `it.skip(...)`, `test.skip(...)`, `describe.skip(...)`            |
| `xit` / `xdescribe` / `xtest`                   | the `x`-prefixed aliases                                          |
| `test.todo()` / `it.todo()`                     | "I promise to write this later" — write it now or don't write it  |
| Empty spec files                                | `*.spec.ts` / `*.test.ts` containing zero `it()` / `test()` calls |
| Trivial-pass placeholders                       | `it('placeholder', () => { expect(true).toBe(true); })`           |
| Runner flags that mask empty suites             | `--passWithNoTests`, `vitest --passWithNoTests`                   |
| E2E tests skipped because infra is "down"       | e.g. `it.skipIf(!db)` — bring the infra up or don't ship the test |
| Vitest config `test.skip`                       | `test: { skip: true }` in any `vitest.config.*`                   |
| Conditional `describe` / `it` based on env vars | `if (process.env.X) describe(...)` — fix the env or fix the test  |

Behavior isn't ready yet → don't write the test yet; add it as a task
in the relevant `.openspec/changes/<feature>/tasks.md`. Test would be
flaky → fix the root cause. Test depends on an external service →
mock it deterministically or use Testcontainers.

## Consequences

- **Easier:** A green build is genuinely green.
- **Harder:** Every new package must ship with at least one real test
  on day one. New packages that aren't ready to test can't land at all.
- **Trade-off:** Accept — the cost of "no fake-green" is the cost of
  shipping real coverage.

## Enforcement

- Auto-check **INC-012** in `.harness/check.sh` scans every
  `*.spec.ts`, `*.test.ts`, `*.spec.tsx`, `*.test.tsx`, and
  `package.json` for the patterns above and fails the build on any
  match (with `node_modules`, `.next`, `dist`, `.turbo`, `coverage`,
  `standalone` pruned from the search).
- Skill: `AGENTS.md §No skipped tests`.
````

- [ ] **Step 4: Create `docs/decisions/ADR-008-capture-scripts-bash-and-python3-only.md`**

Write this exact content:

```markdown
# ADR-008 — Capture scripts use bash + python3 only

- **Status:** Accepted
- **Date:** 2026-08-04
- **Incident reference:** INC-013 (full context in `.harness/INCIDENTS.md`)

## Context

The original Prettier `PostToolUse` hook in `~/.claude/settings.json`
began with `jq -r '.tool_response.filePath // .tool_input.file_path'`.
The `jq` binary was not installed on this developer's machine. The
hook was a no-op for the entire lifetime of the file — every code
change went through without auto-formatting. No one noticed because
hooks failing silently produce no user-visible signal.

## Decision

All capture scripts under `.harness/` — specifically:

- `.harness/capture.sh`
- `.harness/detect.sh`
- `.harness/digest.py`
- `.harness/pattern_match.py`
- `.harness/redact.py`

MUST use bash + `python3` stdlib only. Adding `jq` (or any other
top-level binary dependency) to a capture hook is a **forbidden
action** — see AGENTS.md §Forbidden actions.

If a hook needs a new binary, the addition must:

1. Be added to this ADR and the AGENTS.md forbidden-actions list.
2. Add a corresponding auto-check that asserts the binary is present
   AND forbidden in capture paths.
3. Be reviewed and merged as a deliberate decision.

## Consequences

- **Easier:** Capture hooks are portable across macOS, Linux, and WSL
  without per-OS install paths.
- **Harder:** A few scripts become slightly more verbose
  (`python3 -c 'import json,sys; …'` instead of `jq …`).
- **Trade-off:** Accept — observability portability is the goal.

## Enforcement

- Auto-check **INC-013** in `.harness/check.sh`:
  - Asserts `python3` is present.
  - Greps every capture script for `jq` and fails the build on match.
- Skill: `AGENTS.md §Continuous learning → Capture dependencies`.
```

- [ ] **Step 5: Verify all four files exist**

Run:

```bash
ls -1 docs/decisions/ADR-00[5-8]*.md
```

Expected: four filenames printed, in order.

- [ ] **Step 6: Commit**

```bash
git add docs/decisions/ADR-005-non-default-ports.md \
        docs/decisions/ADR-006-nest-logger-not-console.md \
        docs/decisions/ADR-007-no-skipped-tests.md \
        docs/decisions/ADR-008-capture-scripts-bash-and-python3-only.md
git commit -m "docs(sdd): add ADRs 005-008 (ports, Logger, no-skip, capture deps)

ADR-005 INC-008 non-default host ports
ADR-006 INC-009 Nest Logger over console.*
ADR-007 INC-012 zero tolerance: no skipped tests
ADR-008 INC-013 capture scripts: bash + python3 only

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Create ADRs 009-011 (events transient, digest freshness, no plaintext secrets)

**Files:**

- Create: `docs/decisions/ADR-009-events-directory-is-gitignored.md`
- Create: `docs/decisions/ADR-010-daily-digest-freshness.md`
- Create: `docs/decisions/ADR-011-no-plaintext-secrets-in-source.md`

- [ ] **Step 1: Create `docs/decisions/ADR-009-events-directory-is-gitignored.md`**

Use the `Write` tool with this exact content:

````markdown
# ADR-009 — `.harness/events/` is gitignored (session state, not source-of-truth)

- **Status:** Accepted
- **Date:** 2026-08-04
- **Incident reference:** INC-014 (full context in `.harness/INCIDENTS.md`)

## Context

The L1 capture hook writes one NDJSON line per tool call under
`.harness/events/<date>.jsonl`. The lines include tool inputs (file
paths, commands, brief snippets) and tool outputs (error messages that
may reference tokens after redaction).

This is **per-session observation data**, not source-of-truth. Committing
the events dir has two failure modes:

1. **Privacy / hygiene** — leaks session state, possibly with
   redacted-but-still-sensitive context, into public git history.
2. **Policy muddle** — mixes "what is committed" with "what was
   observed", undermining the rule that commits are auditable.

The source-of-truth lives in `.harness/digest/<date>.md` (human-readable
daily summary) and `.harness/proposed/<date>.patch` (proposed patches).
Both stay committed.

## Decision

`.harness/events/` is **session state**, NOT source-of-truth. It MUST
be listed in `.gitignore`. The aggregated output (`.harness/digest/`)
and the proposed patches (`.harness/proposed/`) ARE source-of-truth
and stay committed.

```gitignore
# in .gitignore
.harness/events/
```
````

The gitignore entry must come ABOVE any "ignore tracking" comment for
clarity.

## Consequences

- **Easier:** Privacy footprint stays local to the developer's machine;
  commits are auditable.
- **Harder:** We can't replay past sessions for forensics — but the
  digest captures the conclusions, and the raw events were always
  volatile observation data.
- **Trade-off:** Accept — replay matters less than the conclusions.

## Enforcement

- Auto-check **INC-014** in `.harness/check.sh` asserts `.gitignore`
  contains the `.harness/events/` entry.
- Skill: `AGENTS.md §Continuous learning → Events are transient`.

````

- [ ] **Step 2: Create `docs/decisions/ADR-010-daily-digest-freshness.md`**

Write this exact content:

```markdown
# ADR-010 — Daily digest must be fresh (< 25h old)

- **Status:** Accepted
- **Date:** 2026-08-04
- **Incident reference:** INC-015 (full context in `.harness/INCIDENTS.md`)

## Context

The harness is a closed feedback loop. The L3 layer (daily digest) is
where captured events become proposed improvements to
`learnings.json`, `AGENTS.md`, and skills. If the digest agent dies
silently — scheduler crash, worker error, paused session, vacation —
the loop stalls, events accumulate under `.harness/events/`, and the
operator has no signal that learning has stopped.

## Decision

At any time, the newest `.harness/digest/<date>.md` MUST have an mtime
within the last 25 hours. The 25-hour bucket is intentional: a 24-hour
window would flag the operator's everyday evening cadence; 25 hours
absorbs one skipped day (vacation) without triggering.

The digest is produced:

- **Automatically** — via the L3 CronCreate at 22:03 local time.
- **Manually** — via `pnpm harness:digest` for on-demand refresh.

If the freshness check fails, run `pnpm harness:digest` to refresh.

## Consequences

- **Easier:** The operator always knows whether the loop is healthy.
- **Harder:** A failure in the daily digest blocks the build (this is
  the point).
- **Trade-off:** Accept — silent learning stall is worse than a noisy
  build.

## Enforcement

- Auto-check **INC-015** in `.harness/check.sh`:
  - Asserts `.harness/digest/` exists.
  - Asserts newest digest mtime is < 25h.
  - Error message: _"Fix: run \`pnpm harness:digest\` to refresh the
    daily digest."_ (Alura principle — linter messages that come with
    the fix instruction).
- Skill: `AGENTS.md §Continuous learning → Daily digest freshness`.
````

- [ ] **Step 3: Create `docs/decisions/ADR-011-no-plaintext-secrets-in-source.md`**

Write this exact content:

```markdown
# ADR-011 — No plaintext tokens in source

- **Status:** Accepted
- **Date:** 2026-08-04
- **Incident reference:** INC-016 (full context in `.harness/INCIDENTS.md`)

## Context

Tokens travel through editor copy-paste, AI assistant context, env
var dumps, and example docs. The `~/.claude/settings.json` file on
this machine carries a live `ANTHROPIC_AUTH_TOKEN` (`sk-cp-…`) and
`GITHUB_PERSONAL_ACCESS_TOKEN` (`github_pat_…`) in plaintext. Any hook
that captures tool inputs without redaction risks writing these tokens
to disk.

A leaked token in source code can never be fully removed from git
history — the original SHA remains reachable to anyone who clones.

## Decision

Two-layer defense:

1. **Redaction at capture (seatbelt).** `.harness/redact.py` strips
   known token shapes from tool inputs and outputs before they hit
   `.harness/events/`. Run on every Bash/Edit/Write/MCP via the L1 hook.

2. **Secret-shape scan at pre-commit (airbag).** Auto-check **INC-016**
   in `.harness/check.sh` greps every `*.ts`, `*.tsx`, `*.js`, `*.jsx`
   under `apps/` and `packages/` for known token shapes:
   - `sk-ant-` — Anthropic API
   - `sk-cp-` — Anthropic CodePlan
   - `ghp_` — GitHub PAT (classic)
   - `github_pat_` — GitHub fine-grained PAT
   - `AKIA…` — AWS access key

Build fails on any match with the message: _"Fix: rotate the token and
move to a secret store; do not commit plaintext credentials."_

## Consequences

- **Easier:** Two layers mean one can fail without the other; a
  forgotten redaction still leaves the source clean.
- **Harder:** Test fixtures must not use real token shapes (use
  `sk-ant-test-EXAMPLE` or similar synthesized strings).
- **Trade-off:** The regex check catches the common shapes but a
  determined attacker can obfuscate around it. The goal is
  "no accidents", not "no adversarial bypasses" — for adversarial
  bypasses we'd add `gitleaks` as a future CI step.

## Enforcement

- Auto-check **INC-016** in `.harness/check.sh`:
  - Greps `apps/**/*.{ts,tsx,js,jsx}` and `packages/**/*.{ts,tsx,js,jsx}`
    for the shapes above.
  - Pruning: `node_modules`, `.next`, `dist`, `.turbo`, `coverage`.
  - Error message: _"Fix: rotate the token; do not commit plaintext
    credentials."_
- Skill: `AGENTS.md §Continuous learning → No plaintext secrets`.
```

- [ ] **Step 4: Verify all three files exist**

Run:

```bash
ls -1 docs/decisions/ADR-0[9]*.md docs/decisions/ADR-1[0-1]*.md
```

Expected: three filenames printed, in order.

- [ ] **Step 5: Commit**

```bash
git add docs/decisions/ADR-009-events-directory-is-gitignored.md \
        docs/decisions/ADR-010-daily-digest-freshness.md \
        docs/decisions/ADR-011-no-plaintext-secrets-in-source.md
git commit -m "docs(sdd): add ADRs 009-011 (events, digest, no plaintext)

ADR-009 INC-014 events directory is gitignored
ADR-010 INC-015 daily digest freshness (< 25h)
ADR-011 INC-016 no plaintext tokens in source

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Rewrite `CLAUDE.md`

**Files:**

- Modify: `CLAUDE.md` (full rewrite)

- [ ] **Step 1: Write the new `CLAUDE.md`**

Use the `Write` tool with this exact content (the tool will refuse if you
haven't read the current file in this session — you can read it with the
`Read` tool, but the content you overwrite is preserved in git):

````markdown
# CLAUDE.md

This file guides Claude Code (claude.ai/code) when working in this
repository. Read order: this file, then [AGENTS.md](AGENTS.md), then
[.openspec/AGENTS.md](.openspec/AGENTS.md).

`AGENTS.md` is the authoritative rule set for every AI assistant
working on this project (Claude Code, Gemini CLI, Codex, etc.). This
file is a Claude-Code-oriented index into it. **If anything here
conflicts with `AGENTS.md`, `AGENTS.md` wins.**

---

## 1. Project snapshot

- **Monorepo blueprint:** Next.js 15 + NestJS 11 (Fastify) +
  Prisma 6 + PostgreSQL 16. SDD-driven.
- **Editor of record:** Visual Studio Code (workspace config in
  `.vscode/`).
- **Local stack:** 5-service `docker-compose.yml` —
  `postgres`, `api`, `web`, `mailhog`, `otel-collector`.
- **Auth:** JWT access (15m, in-memory) + rotated refresh in
  httpOnly cookie + Argon2id passwords.
- **Port policy:** non-default host ports to avoid sibling-project
  collisions (`INC-008`, see [ADR-005](docs/decisions/ADR-005-non-default-ports.md)).
  Current map: API 3001, Web 3000, MailHog smtp 11125, MailHog ui 18025.
- **Repo layout:** `apps/{api,web}`, `packages/{db,contracts,ui,config-*}`.

---

## 2. Common commands

Full list in [AGENTS.md §Common commands](AGENTS.md#common-commands).
Quick reference:

```bash
pnpm up                 # docker compose up (all 5 services)
pnpm down               # docker compose down
pnpm logs               # tail logs from all services
pnpm db:migrate         # prisma migrate dev (in api container)
pnpm db:seed            # seed admin user
pnpm db:reset           # reset + migrate + seed
pnpm test               # unit + e2e across packages
pnpm lint               # eslint flat config everywhere
pnpm typecheck          # tsc --noEmit everywhere
pnpm harness:check      # 16 auto-checks (prebuild)
pnpm harness:digest     # write today's digest + propose patches
pnpm harness:apply      # apply a proposed patch (refuses forbidden paths)
pnpm harness:codemod    # run a feedforward codemod (e.g. inc-002)
pnpm harness:test       # codemod unit tests
```
````

---

## 3. High-level architecture

- **`apps/api`** — NestJS 11 on Fastify. Modules under
  `apps/api/src/modules/<area>/`. Public surface at
  `http://localhost:3001`, Swagger UI at `/docs`.
- **`apps/web`** — Next.js 15 (App Router). Server components by
  default; client only where state demands it. Mounted at
  `http://localhost:3000`.
- **`packages/db`** — Prisma client re-export. **Only `apps/api`
  imports Prisma directly.** `apps/web` consumes via
  `packages/contracts` DTOs (forbidden action — see AGENTS.md).
- **`packages/contracts`** — Zod schemas shared front + back
  (compiled to `dist/`). Authoritative request/response shape.
- **`packages/ui`** — shadcn/ui components (local, no vendor
  lock-in).
- **`packages/config-{eslint,tailwind,tsconfig}`** — shared flat
  configs.

**Request flow (web → api):**

```
Web server action ─fetch─→ @ai-padrao/contracts (Zod parse)
                       ─→ NestJS controller
                       ─→ service
                       ─→ @ai-padrao/db (Prisma)
                       ─→ Postgres 16
```

**Auth flow:**

1. `POST /api/auth/login` returns `{ accessToken, refreshCookie }`.
2. Access token lives in web memory; refresh in httpOnly cookie.
3. On 401, web server action POSTs to `/api/auth/refresh`,
   which rotates the refresh cookie (single-use).

**Observability:**

- OpenTelemetry SDK in both `apps/api` and `apps/web`.
- OTLP export to the local `otel-collector` service.
- All app logs flow through Nest's `Logger` (no `console.*` —
  see [ADR-006](docs/decisions/ADR-006-nest-logger-not-console.md)).

---

## 4. Conventions unique to this repo

These are non-obvious guardrails; the full list lives in
[AGENTS.md §Forbidden actions](AGENTS.md#forbidden-actions). The
short version:

- **SDD is mandatory.** Every behavior change goes through OpenSpec
  first. See [.openspec/AGENTS.md](.openspec/AGENTS.md) for the
  workflow.
- **Zero-tolerance: no skipped tests.** No `.skip()`, no `xit`,
  no `--passWithNoTests`. A skipped test is a lie. See
  [ADR-007](docs/decisions/ADR-007-no-skipped-tests.md).
- **No Prisma direct in `apps/web`.** Use
  `packages/contracts` DTOs.
- **DI'd service imports are runtime values, not `import type`** —
  TypeScript erases the value, NestJS DI dies. See
  [ADR-002](docs/decisions/ADR-002-no-import-type-for-nest-di.md).
- **Capture scripts use bash + python3 only.** No `jq`, no new
  binary deps. See
  [ADR-008](docs/decisions/ADR-008-capture-scripts-bash-and-python3-only.md).
- **Commits:** Conventional Commits with the scopes
  `api`, `web`, `db`, `contracts`, `ui`, `config`, `sdd`,
  `harness`, `root`, `docker`, `deps`.
- **Precedence:** `AGENTS.md > CLAUDE.md` for rules.
  `docs/decisions/ADR-XXX` > AGENTS.md for the specific
  incident context. `.harness/INCIDENTS.md` is the full
  source-of-truth for any ADR.

---

## 5. Editor / AI-assistant config

- **VSCode workspace settings:** `.vscode/settings.json`
  (format-on-save, ESLint flat config, monorepo-aware paths).
- **Recommended extensions:** `.vscode/extensions.json`.
- **AI rule single source of truth:**
  [AGENTS.md](AGENTS.md) — read by Claude Code, Gemini CLI,
  Codex, and any other AI assistant.
- **OpenSpec workflow:**
  [.openspec/AGENTS.md](.openspec/AGENTS.md) — the
  proposal → tasks → design → spec → archive lifecycle.
  Templates in [`.openspec/templates/`](.openspec/templates/).
- **Project-specific decisions** (Architecture Decision Records):
  [`docs/decisions/`](docs/decisions/) — 11 ADRs; see the next
  section.

---

## 6. Project-specific ADRs (when to open each)

The full ADRs live in [docs/decisions/](docs/decisions/). Each
summarizes a real incident and the rule it produced. Open the ADR
when you're about to touch its area.

| When you're editing…                                | Read                                                                        |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| NestJS interceptor / middleware in `apps/api`       | [ADR-001](docs/decisions/ADR-001-fastify-reply-api.md)                      |
| Imports in NestJS controllers / services / guards   | [ADR-002](docs/decisions/ADR-002-no-import-type-for-nest-di.md)             |
| A new health/auth endpoint                          | [ADR-003](docs/decisions/ADR-003-public-decorator-on-health-auth.md)        |
| `apps/api/Dockerfile` or any Dockerfile with Prisma | [ADR-004](docs/decisions/ADR-004-dockerfile-copy-schema-before-generate.md) |
| `docker-compose.yml` port bindings                  | [ADR-005](docs/decisions/ADR-005-non-default-ports.md)                      |
| `apps/api/src/main.ts`                              | [ADR-006](docs/decisions/ADR-006-nest-logger-not-console.md)                |
| Any test file                                       | [ADR-007](docs/decisions/ADR-007-no-skipped-tests.md)                       |
| Anything under `.harness/*.sh` or `.harness/*.py`   | [ADR-008](docs/decisions/ADR-008-capture-scripts-bash-and-python3-only.md)  |
| `.gitignore` or `.harness/events/`                  | [ADR-009](docs/decisions/ADR-009-events-directory-is-gitignored.md)         |
| Whether the harness is healthy                      | [ADR-010](docs/decisions/ADR-010-daily-digest-freshness.md)                 |
| Anything that might include a secret                | [ADR-011](docs/decisions/ADR-011-no-plaintext-secrets-in-source.md)         |

---

## 7. What this file does NOT cover

For each of these, follow the link — the linked document is the
authority, this file is just an index:

- OpenSpec proposal / tasks / design / specs workflow →
  [.openspec/AGENTS.md](.openspec/AGENTS.md)
- Harness capture / digest / codemod / check internals →
  [.harness/README.md](.harness/README.md)
- Full incident context for every ADR →
  [.harness/INCIDENTS.md](.harness/INCIDENTS.md)
- Authoritative rules every AI must follow →
  [AGENTS.md](AGENTS.md)

````

- [ ] **Step 2: Verify the new file is in place**

Run:
```bash
wc -l CLAUDE.md && grep -c "ADR-" CLAUDE.md
````

Expected: line count ≈ 180–210; the second number should be 12 or
more (ADR indices × 11 ADRs + a few header mentions).

- [ ] **Step 3: Confirm the placeholder language is gone**

Run:

```bash
grep -n "freshly initialized\|only tracked file" CLAUDE.md
```

Expected: no output (exit code 1). If anything prints, the rewrite
is incomplete.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(root): rewrite CLAUDE.md to reflect post-stabilization state

Replaces the original 27-line placeholder (which still claimed the
repo was freshly initialized with only README.md tracked) with a
Claude-Code-oriented index: project snapshot, common commands,
architecture, conventions, editor config, and an 11-row ADR pointer
table. The four 'future sections' the original CLAUDE.md listed as
TODOs are now the four content sections (Snapshot, Commands,
Architecture, Conventions).

Authority precedence baked in: AGENTS.md > CLAUDE.md for rules;
docs/decisions/ADR-XXX > AGENTS.md for incident context;
.harness/INCIDENTS.md is the source-of-truth for any ADR.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Fix `README.md` (3 surgical edits)

**Files:**

- Modify: `README.md` (lines 97, 116, 152)

- [ ] **Step 1: Confirm the exact strings to change**

The baseline numbers from Task 1 (Step 1) are the new values. The
three existing strings to find are:

- Line 97: `Currently 16 PASS / 0 FAIL / 3 SKIP (manual).` — replace
  with the verified `PASS / FAIL / SKIP` from Task 1 Step 1. The
  precise replacement is
  `` `Currently ${PASS_FROM_TASK_1} PASS / 0 FAIL / ${SKIP_FROM_TASK_1} SKIP (manual).` ``.

- Line 116 (inside the "Project policies" bullet list): the bullet
  ending in `Enforced by INC-012.` is preceded by a header
  `## Project policies (zero-tolerance)`. Look for any reference
  to "12" inside this section and replace with "16".

- Line 152 (inside `## Further reading`): the bullet
  `— the 12 incidents that shaped the policies above.`
  Replace `12` with `16`.

- [ ] **Step 2: Apply the line-116 fix**

Open `README.md` and locate the line that mentions "12" inside the
`## Project policies (zero-tolerance)` section (currently ends with
the phrase `All 12 incidents have prevention rules`). Use the
`Edit` tool with:

```
old_string:
- ❌ **No skipped tests** — `it.skip`, `xit`, `xdescribe`, `xtest`, `it.todo`, `--passWithNoTests`, and conditional `describe/it` are all forbidden. Tests are real or they don't exist. _Enforced by INC-012._

new_string:
- ❌ **No skipped tests** — `it.skip`, `xit`, `xdescribe`, `xtest`, `it.todo`, `--passWithNoTests`, and conditional `describe/it` are all forbidden. Tests are real or they don't exist. _Enforced by INC-012._ (All 16 incidents have prevention rules.)
```

If `old_string` doesn't match exactly (multi-line context), widen
the match to include the surrounding text.

- [ ] **Step 3: Apply the line-152 fix**

Use the `Edit` tool with:

```
old_string:
- [`.harness/INCIDENTS.md`](.harness/INCIDENTS.md) — the 12 incidents that shaped the policies above.

new_string:
- [`.harness/INCIDENTS.md`](.harness/INCIDENTS.md) — the 16 incidents that shaped the policies above.
```

- [ ] **Step 4: Apply the line-97 fix**

Use the `Edit` tool with the verified number. Example, if the run
returned `14 PASS / 0 FAIL / 2 SKIP`:

```
old_string:
- `.harness/check.sh` — runs all auto-checks before every build. Currently 16 PASS / 0 FAIL / 3 SKIP (manual).

new_string:
- `.harness/check.sh` — runs all auto-checks before every build. Currently 14 PASS / 0 FAIL / 2 SKIP (manual).
```

If the actual numbers differ, substitute the real PASS / SKIP values.

- [ ] **Step 5: Verify no stale "12 incidents" reference remains**

Run:

```bash
grep -n "12 incidents\|12 incidents\| 12 |" README.md
```

Expected: no output. (Specifically: no "12 incidents" phrase and no
`12 |` numeric reference.)

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs(root): reconcile incident counts in README (12 -> 16)

Three surgical fixes: line 97 (PASS/SKIP counts from harness output),
line 116 (policy header), line 152 (Further reading). Uses verified
numbers from pnpm harness:check, captured at the start of the audit.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Rebuild `.harness/README.md` (Current state table + Coverage map)

**Files:**

- Modify: `.harness/README.md` (lines 53-61 table; lines 62-78 coverage map; line 80 summary)

- [ ] **Step 1: Read the current `.harness/README.md`**

Run:

```bash
cat -n .harness/README.md | sed -n '50,90p'
```

This shows the lines you'll be editing in their full context.

- [ ] **Step 2: Replace the "Current state" table (lines 51-65)**

Use the `Edit` tool with the existing header as anchor. The "Current
state" header reads:

```
## Current state (as of 2026-08-04)
```

Replace the entire table under that header (the next 13 lines — from
`| Metric | Value |` to the last row before `## Coverage map`) with:

```
| Total incidents logged       | 16 (INC-001..INC-016)                                          |
| With skill prevention        | 14 (all except INC-010, INC-012, INC-016 which are policy-only) |
| With policy prevention       | 16 (100%)                                                       |
| With auto_check (machine-verifiable) | 14 / 16 (88%)                                           |
| Manual / SKIP                | 2 (INC-003 nest-DI lint boundary, INC-010 docs-only)            |
| Categories covered           | 10 distinct                                                     |
| Skills referenced            | 2 (`nestjs-fastify-gotchas`, `pnpm-monorepo-script-pitfalls`)    |
| Skills to create             | 0 (no gap detected)                                             |
| Last refresh                 | mtime of newest `.harness/digest/*.md` < 25h (see ADR-010)       |
```

(The exact replacement anchors on `## Current state (as of 2026-08-04)` and
extends until the line before `## Coverage map`.)

- [ ] **Step 3: Extend the "Coverage map" table (lines 62-78)**

The current table covers INC-001..INC-012. Replace the entire table
with one that covers all 16:

```
| Category                       | INC            | Skill                                  | Auto-check         |
| ------------------------------ | -------------- | -------------------------------------- | ------------------ |
| platform-dep                   | INC-001        | nestjs-fastify-gotchas                 | package_json_dep   |
| api-compat                     | INC-002        | nestjs-fastify-gotchas                 | grep_audit         |
| decorator-metadata             | INC-003        | nestjs-fastify-gotchas                 | lint_rule_override (manual) |
| prisma-config                  | INC-004        | pnpm-monorepo-script-pitfalls          | package_json_field |
| auth-guard                     | INC-005        | nestjs-fastify-gotchas                 | e2e_test           |
| dockerfile-order               | INC-006        | pnpm-monorepo-script-pitfalls          | dockerfile_lint    |
| eslint-config                  | INC-007        | pnpm-monorepo-script-pitfalls          | grep_audit         |
| port-collision                 | INC-008        | pnpm-monorepo-script-pitfalls          | compose_lint       |
| logger-pattern                 | INC-009        | nestjs-fastify-gotchas                 | grep_audit         |
| peer-warning                   | INC-010        | (docs only — no auto-check)            | —                  |
| vite-cjs                       | INC-011        | (env_var: VITE_CJS_IGNORE_WARNING)     | grep_audit         |
| test-discipline                | INC-012        | AGENTS.md §No skipped tests            | grep_audit         |
| capture-dependencies           | INC-013        | AGENTS.md §Capture dependencies        | grep_audit         |
| events-hygiene                 | INC-014        | AGENTS.md §Events are transient        | gitignore_contains |
| digest-freshness               | INC-015        | AGENTS.md §Daily digest freshness      | mtime_check        |
| secrets-in-source              | INC-016        | AGENTS.md §No plaintext secrets        | grep_audit         |
```

(Edit using `Edit` with the entire existing table block as
`old_string`.)

- [ ] **Step 4: Update the trailing summary (line 80)**

Find:

```
All 12 incidents have prevention rules. 10 of 12 are machine-verifiable.
```

Replace with:

```
All 16 incidents have prevention rules. 14 of 16 are machine-verifiable (INC-003 and INC-010 are manual).
```

- [ ] **Step 5: Verify the changes look right**

Run:

```bash
grep -n "12 incidents\|10 of 12\|10 / 12\| 12 " .harness/README.md
```

Expected: no output. (All "12" references inside the metrics block
must be gone.)

- [ ] **Step 6: Commit**

```bash
git add .harness/README.md
git commit -m "docs(harness): extend coverage map and update state table to 16 INC

Adds INC-013..INC-016 rows to the coverage map; updates the 'Current
state' table from 12 -> 16 incidents / 10/12 -> 14/16 auto-checked.
The remaining 2 manual checks (INC-003 lint boundary, INC-010 docs-only)
are called out explicitly.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: Create `CONTRIBUTING.md`

**Files:**

- Create: `CONTRIBUTING.md`

- [ ] **Step 1: Write `CONTRIBUTING.md`**

Use the `Write` tool with this exact content:

````markdown
# Contributing to ai-padrao

Thanks for your interest in `ai-padrao`. This document is for **human
contributors** working in this repo. (AI assistants read
[AGENTS.md](AGENTS.md) instead.)

## Code of conduct

Be kind. Critique the code, not the person. We optimize for "the next
person reading this PR will understand why we made this call".

## Development setup

**Prerequisites:**

- Node 22+ (`node --version`)
- pnpm 9+ via [corepack](https://nodejs.org/api/corepack.html)
  (`corepack enable && corepack prepare pnpm@latest --activate`)
- Docker + Docker Compose

**Quickstart:**

```bash
git clone <repo-url> my-project
cd my-project
pnpm install
cp .env.example .env
pnpm up
pnpm db:migrate
pnpm db:seed
```
````

Open [http://localhost:3000](http://localhost:3000) (web) and
[http://localhost:3001/docs](http://localhost:3001/docs) (Swagger UI).
Default seed user: `admin@ai-padrao.local` / `admin123`.

**Verify your setup is healthy:**

```bash
pnpm harness:check    # 14 auto-checks (per .harness/README.md)
pnpm test             # unit + e2e tests across packages
pnpm lint             # eslint flat config everywhere
pnpm typecheck        # tsc --noEmit everywhere
```

All four must finish green before you open a PR.

## Workflow: SDD is mandatory

Every new feature or behavior change goes through the
[Spec-Driven Development](.openspec/AGENTS.md) workflow. **Open a
proposal in `.openspec/changes/<feature>/` before writing any code.**
Wait for a human to approve `proposal.md`. Then implement the tasks
in order. The workflow is documented in full in
[`.openspec/AGENTS.md`](.openspec/AGENTS.md).

What's exempt: cosmetic changes (typos, formatting, no-behavior
refactors), dependency version bumps without API impact, and
documentation fixes.

## Conventional Commits

We use [Conventional Commits](https://www.conventionalcommits.org/).
Format: `<type>(<scope>): <subject>`.

**Allowed scopes** (enforced by `.commitlintrc.json`):

`root`, `api`, `web`, `contracts`, `db`, `ui`, `config`, `docker`,
`sdd`, `deps`, `harness`.

**Allowed types:** `feat`, `fix`, `docs`, `chore`, `refactor`,
`perf`, `test`, `build`, `ci`, `style`, `revert`.

**Pre-commit hooks** (via husky + lint-staged):

- `commitlint` — Conventional Commits format
- `prettier` — formatting via the L1 capture hook (see ADR-008)
- The commit-msg hook runs `commitlint` automatically

**When `--no-verify` is acceptable:** lockfile regeneration, mass
stabilization commits, version bumps. Always note the bypass in the
commit body.

## Pull request checklist

Before requesting review, confirm:

- [ ] SDD proposal merged (or exempt per "Workflow" above).
- [ ] Conventional Commits format used.
- [ ] `pnpm harness:check` — 14 PASS, 0 FAIL.
- [ ] `pnpm test` — green.
- [ ] `pnpm lint` — clean.
- [ ] `pnpm typecheck` — clean.
- [ ] No new skipped tests (zero-tolerance — see
      [ADR-007](docs/decisions/ADR-007-no-skipped-tests.md)).
- [ ] No commits under `.harness/events/` (gitignored — see
      [ADR-009](docs/decisions/ADR-009-events-directory-is-gitignored.md)).
- [ ] No plaintext tokens (`sk-ant-`, `sk-cp-`, `ghp_`,
      `github_pat_`, `AKIA…`) — see
      [ADR-011](docs/decisions/ADR-011-no-plaintext-secrets-in-source.md).
- [ ] If the PR changes architecture: ADR updated under
      `docs/decisions/` (or referenced from the change).
- [ ] PR description links to `.openspec/changes/<feature>/` if
      applicable.

## Adding a new INC (incident report)

After fixing a non-trivial bug:

1. **Append an entry** to [`.harness/INCIDENTS.md`](.harness/INCIDENTS.md)
   with: symptom, root cause, fix, prevention rule. Use the existing
   format.
2. **Update** [`.harness/learnings.json`](.harness/learnings.json)
   with structured `trigger_pattern` + `prevention` metadata.
3. **Consider a codemod** (if the pattern is regular enough to
   rewrite deterministically). Add under
   `.harness/codemods/inc-XXX-…`.
4. **Consider an ADR** under `docs/decisions/` if the rule is
   likely to recur or shape future work.
5. **Consider an auto-check** in `.harness/check.sh` if the
   prevention needs to be machine-verifiable.

## Where decisions live

| Where                                            | What lives there                                       |
| ------------------------------------------------ | ------------------------------------------------------ |
| [`.harness/INCIDENTS.md`](.harness/INCIDENTS.md) | Full incident context (source of every ADR)            |
| [`docs/decisions/`](docs/decisions/)             | Architecture Decision Records (Nygard format)          |
| [`.openspec/specs/`](.openspec/specs/)           | Archived feature specs (after a feature is merged)     |
| [`.openspec/changes/`](.openspec/changes/)       | In-progress SDD proposals + tasks + designs            |
| [`AGENTS.md`](AGENTS.md)                         | Authoritative rules for every AI agent                 |
| [`CLAUDE.md`](CLAUDE.md)                         | Claude-Code-oriented index into AGENTS.md and the ADRs |

If you can't find what you're looking for, check
[`.harness/README.md`](.harness/README.md) — it lists all harness
files and their roles.

## Reporting issues

**Bugs and feature requests:** open an issue with the appropriate
template (`bug.md` or `feature.md` in `.github/ISSUE_TEMPLATE/`).

**Security disclosures:** **do not** open a public issue. Follow the
process in [ADR-011](docs/decisions/ADR-011-no-plaintext-secrets-in-source.md):
rotate the token, audit git history, and notify the maintainers
directly. A leaked token in a public issue thread is never
recoverable.

````

- [ ] **Step 2: Verify the file is well-formed**

Run:
```bash
test -f CONTRIBUTING.md && wc -l CONTRIBUTING.md
````

Expected: a line count between 120 and 180.

- [ ] **Step 3: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs(root): add CONTRIBUTING.md

PR workflow + SDD reference + Conventional Commits scope allowlist +
verification checklist + incident / ADR / auto-check rules for new
contributors. Documents the zero-tolerance policies (no skipped
tests, no plaintext secrets, no Prisma in apps/web) for humans.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 10: Create `ARCHITECTURE.md`

**Files:**

- Create: `ARCHITECTURE.md`

- [ ] **Step 1: Write `ARCHITECTURE.md`**

Use the `Write` tool with this exact content:

```markdown
# Architecture

This document sketches the big picture. For the full design spec, see
[`docs/superpowers/specs/2026-08-04-ai-padrao-blueprint-design.md`](docs/superpowers/specs/2026-08-04-ai-padrao-blueprint-design.md).
For the rationale behind any single decision, see
[`docs/decisions/`](docs/decisions/).

## High-level diagram
```

        ┌─────────────────────────────────────────────────────┐
        │                  BROWSER (developer / user)         │
        └────────────────────────┬────────────────────────────┘
                                 │ HTTPS
        ┌────────────────────────▼────────────────────────────┐
        │          apps/web   (Next.js 15, App Router)        │
        │  Server Components · Server Actions · Middleware    │
        │  httpOnly refresh cookie + in-memory access JWT     │
        └────┬───────────────────┬─────────────────┬─────────┘
             │ fetch             │ fetch           │ OTLP
             ▼                   ▼                 ▼

┌──────────────────┐ ┌───────────────────┐ ┌──────────────────┐
│ apps/api │ │ apps/api │ │ otel-collector │
│ (Nest 11 + │ │ (Nest 11 + Fastify)│ │ (OTLP receiver) │
│ Fastify) │ │ │ └──────────────────┘
│ http://:3001 │ └────────┬──────────┘
└────┬─────────────┘ │ Prisma
│ Zod-validated DTOs ▼
│ via @ai-padrao/contracts ┌──────────────────────────┐
│ (shared Zod schemas) │ postgres (Postgres 16) │
└──────────────────────────┘ http://:5432 (or remapped)
▲
│ SMTP (dev)
┌───────────────────────────┴─────────────────────┐
│ mailhog (dev SMTP capture) http://:11125 / 18025│
└─────────────────────────────────────────────────┘

```

### App and package boundary

```

apps/
api/ NestJS 11 + Fastify REST API
web/ Next.js 15 (App Router) frontend

packages/
db/ Prisma client re-export (apps/api only)
contracts/ Zod schemas — shared front + back
ui/ shadcn/ui components
config-eslint/ shared flat ESLint 9 configs
config-tailwind/ shared Tailwind 4 config
config-tsconfig/ shared TS configs (next, react-library, nest, base)

```

## Apps

### apps/api

- **Purpose:** REST API.
- **Stack:** NestJS 11 on `FastifyAdapter`. Zod request validation
  via `nestjs-zod` (single source of truth from
  `@ai-padrao/contracts`).
- **Entry:** `pnpm up` → service at `http://localhost:3001`. Swagger
  UI at `http://localhost:3001/docs`.
- **Modules:** feature-scoped folders under
  `apps/api/src/modules/<area>/`. Each module owns its controller,
  service, dto, and spec.
- **Cross-cutting:**
  - `JwtAuthGuard` registered globally as `APP_GUARD` (health/auth
    opt out via `@Public()` — see
    [ADR-003](docs/decisions/ADR-003-public-decorator-on-health-auth.md)).
  - `LoggingInterceptor` (uses `reply.header` — see
    [ADR-001](docs/decisions/ADR-001-fastify-reply-api.md)).
  - `Logger` (Nest built-in — see
    [ADR-006](docs/decisions/ADR-006-nest-logger-not-console.md)).

### apps/web

- **Purpose:** Frontend SPA.
- **Stack:** Next.js 15 App Router. Server Components by default;
  Client Components only where state demands. shadcn/ui for local
  components.
- **Entry:** `pnpm up` → service at `http://localhost:3000`.
- **Auth handling:**
  - Access JWT lives in web memory (15 min).
  - Refresh token in httpOnly cookie set by `/api/auth/refresh`.
  - On 401, the API client intercepts and posts to
    `/api/auth/refresh` to rotate.

## Packages

| Package                | Purpose                                                                          |
| ---------------------- | -------------------------------------------------------------------------------- |
| `@ai-padrao/db`        | Prisma client re-export. **Only `apps/api` may import Prisma directly.**          |
| `@ai-padrao/contracts` | Zod schemas shared between front and back. Compiled to `dist/` for ESM import.   |
| `@ai-padrao/ui`        | shadcn/ui components — local, no vendor lock-in, copy/own the source.            |
| `@ai-padrao/config-eslint` | Shared flat-config ESLint 9 setups (one per framework).                       |
| `@ai-padrao/config-tailwind` | Tailwind 4 config shared by web + any future Tailwind user.                  |
| `@ai-padrao/config-tsconfig` | Base + framework-specific TS configs (nest, next, react-library).            |

## Request flow

```

Web server action
│
▼ fetch
/api/...
│
▼
@ai-padrao/contracts (Zod parse → 400 on invalid)
│
▼
NestJS controller → service
│
▼
@ai-padrao/db (Prisma)
│
▼
Postgres 16

```

Plus auth + observability sidebands:

```

                            ┌─── OTLP ──→ otel-collector
                            │

on every request ──────────►├─── Logs ──→ Nest Logger (stdout, JSON-shipped)
│
└─── Metrics ─→ OTel SDK → otel-collector

```

## Persistence

- **Engine:** PostgreSQL 16 (containerized).
- **Migrations:** `pnpm db:migrate` runs `prisma migrate dev` inside
  the api container.
- **Seed:** `pnpm db:seed` creates the admin user
  (`admin@ai-padrao.local` / `admin123`).
- **Access:** Only `apps/api` imports Prisma. `apps/web` reads/writes
  via `packages/contracts` DTOs and the API.

## Self-improving harness

The `.harness/` directory is a closed feedback loop that turns real
defects into durable guardrails. Four layers:

1. **L1 Capture** — every Bash/Edit/Write/MCP appends one NDJSON
   line to `.harness/events/<date>.jsonl` (gitignored), after
   `.harness/redact.py` strips secret shapes.
2. **L2 Inline detection** — `detect.sh` tails the last 20 events,
   runs `pattern_match.py` against `learnings.json` `trigger_pattern`
   entries, and surfaces a confirmation prompt on match.
3. **L3 Daily digest** — a CronCreate at 22:03 local aggregates
   events into `.harness/digest/<date>.md` and proposes patches to
   `learnings.json` / `AGENTS.md` / skills under
   `.harness/proposed/<date>.patch`. Auto-checks assert the digest
   is < 25h old (see
   [ADR-010](docs/decisions/ADR-010-daily-digest-freshness.md)).
4. **L4 Enforcement** — `.harness/check.sh` runs 14 named auto-checks
   (one per documented INC), wired into `pnpm prebuild`.

The loop is bi-directional with AGENTS.md: codemods are
feedforward guides; auto-checks are feedback sensors. See
[`.harness/README.md`](.harness/README.md) and the full
[`INCIDENTS.md`](.harness/INCIDENTS.md).

## Confluence with the stack

Why these choices:

- **pnpm + Turborepo** — fast workspaces, deterministic installs,
  build-cache reuse across packages.
- **NestJS + Fastify** — DI structure without sacrificing throughput.
- **Prisma** — type-safe queries without writing SQL by hand;
  integrates with `@ai-padrao/contracts`.
- **Next.js 15 (App Router)** — Server Components reduce client JS,
  Server Actions colocate mutations with the UI.
- **Zod (via `@ai-padrao/contracts`)** — schemas compile down to one
  source of truth between front (parse for UI) and back (validation
  pipe).
- **shadcn/ui** — copy/own the component source, no vendored
  dependency to update.
- **OpenTelemetry + MailHog + VSCode** — observability + dev email +
  editor standardization, all configured via docker-compose so a
  new contributor gets the same baseline as a six-month veteran.
```

- [ ] **Step 2: Verify the file is well-formed**

Run:

```bash
test -f ARCHITECTURE.md && wc -l ARCHITECTURE.md
```

Expected: a line count between 130 and 180.

- [ ] **Step 3: Commit**

```bash
git add ARCHITECTURE.md
git commit -m "docs(root): add ARCHITECTURE.md

Big-picture view: high-level diagram, app/package boundaries,
request + auth + observability flow, persistence + harness
+ rationale for stack choices. Defers all rule details to
docs/decisions/, AGENTS.md, and .harness/README.md.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 11: Final verification

**Files:**

- Read-only checks across the modified files.

- [ ] **Step 1: Re-run harness check (output should be unchanged)**

Run:

```bash
pnpm harness:check 2>&1 | tail -5
```

Expected: PASS / FAIL / SKIP counts match the values captured in
Task 1 Step 1. Documentation changes must not affect the harness.

- [ ] **Step 2: Sweep for any remaining stale "12 incidents" references**

Run:

```bash
grep -rn "12 incidents\|10 of 12\| 10 / 12\| 12 |" . \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next \
  --exclude-dir=dist --exclude-dir=.turbo \
  --exclude-dir=.harness/events 2>&1 | head -20
```

Expected: no output. If anything prints, that file still has a stale
"12" reference (could be unrelated; review and either fix or
document why it's not a count).

- [ ] **Step 3: Confirm the 12 new ADR files exist**

Run:

```bash
ls docs/decisions/ | wc -l
```

Expected: `12` (11 ADRs + `README.md`).

- [ ] **Step 4: Confirm new top-level files exist**

Run:

```bash
test -f CONTRIBUTING.md && test -f ARCHITECTURE.md && test -f CLAUDE.md && echo OK
```

Expected: `OK`.

- [ ] **Step 5: Confirm CLAUDE.md no longer claims "freshly initialized"**

Run:

```bash
grep -n "freshly initialized" CLAUDE.md
```

Expected: no output.

- [ ] **Step 6: Confirm all internal ADR links resolve**

Run:

```bash
for f in docs/decisions/ADR-*.md; do
  python3 -c "
import re, sys
text = open('$f').read()
broken = []
for link_target in re.findall(r'\]\((\.\./[^)]+|docs/decisions/[^)]+)\)', text):
  if link_target.startswith('../'):
    target = link_target.replace('../', '')
  elif link_target.startswith('docs/decisions/'):
    target = link_target
  if not __import__('os').path.exists(target):
    broken.append(link_target)
if broken:
  print('BROKEN in $f:', broken)
" || true
done
echo "--- link audit done ---"
```

Expected: nothing printed above the `--- link audit done ---`
line. If any `BROKEN in …` lines appear, open the offending file
and fix the link.

- [ ] **Step 7: Commit any final corrections**

If step 6 surfaced broken links, fix them and commit with:

```bash
git add <files>
git commit -m "docs(sdd): fix broken internal links surfaced by audit

Reported by docs/decisions link checker on the post-implementation
sweep. No rule or behavior changes.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-review (after writing this plan)

**Spec coverage:** Six deliverables (CLAUDE.md, README.md,
.harness/README.md, docs/decisions/, CONTRIBUTING.md, ARCHITECTURE.md)
and a final verification step. Tasks 2-5 build the ADR tree; Task 6
rewrites CLAUDE.md; Tasks 7-8 fix the existing files; Tasks 9-10 add
the new top-level docs; Task 11 verifies. Spec section "Acceptance
criteria" 1-7 all map to specific tasks:

- AC1 (`pnpm harness:check` unchanged) → Task 11 step 1.
- AC2 (only listed files modified) → enforced by commit scope.
- AC3 (no source-code changes) → no `apps/` or `packages/`
  edits anywhere in the plan.
- AC4 (numeric claims verified) → Task 1 captures baseline; Tasks 7
  and 8 use those numbers.
- AC5 (ADR format) → each ADR step in Tasks 3-5 uses the exact
  Nygard template explicitly.
- AC6 (`docs/decisions/README.md` lists all 11) → Task 2.
- AC7 (link, don't duplicate) → each new doc section explicitly
  defers to AGENTS.md / .harness/README.md / INCIDENTS.md.

**Placeholder scan:** Every file content is included verbatim in the
relevant Step. No "TBD", no "implement later", no "similar to Task
N". Commands include expected output. Exact file paths.

**Type consistency:** The ADR numbering matches across
`docs/decisions/README.md` (Task 2), each ADR task (3-5), and the
CLAUDE.md ADR-pointer table (Task 6). Inline `Incident reference`
always matches the ADR title via consistent INC-XXX labels.

**Ambiguity:** "Run harness check" — explicitly captured in Task 1.
"Verified PASS/SKIP counts" — same. "Rebuild the table" — anchor
explicit. All commands have expected output.

No spec requirement is left without a task.
