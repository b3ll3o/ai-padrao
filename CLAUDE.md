# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.
The project-wide AI-assistant rulebook lives in [`AGENTS.md`](AGENTS.md);
this file only covers Claude-Code-specific orientation.

## 1. Project identity

This repo is **`ai-padrao`**, a monorepo blueprint for SDD-driven
full-stack apps: Next.js 15 (web) + NestJS 11 / Fastify (api) + Prisma 6

- Postgres, all wired through pnpm 9 workspaces and Turborepo 2. It is a
  **blueprint** — conventions, harnesses, and ADRs are first-class
  deliverables, not just incidental source. The reader is expected to copy
  the shape and adapt the content.

Editor of record: **Visual Studio Code** (settings in `.vscode/`).

## 2. Common commands

All commands run from the repo root unless noted. Defined in
[`package.json`](package.json).

```bash
pnpm up               # docker compose up -d (postgres + mailhog)
pnpm down             # docker compose down
pnpm logs             # docker compose logs -f
pnpm db:migrate       # prisma migrate dev (inside api container)
pnpm db:seed          # prisma seed (admin user)
pnpm db:reset         # prisma migrate reset --force
pnpm dev              # turbo run dev (api + web hot-reload)
pnpm build            # turbo run build (runs pnpm harness:check via prebuild)
pnpm lint             # turbo run lint
pnpm typecheck        # turbo run typecheck
pnpm test             # turbo run test (vitest, unit + e2e)

# Harness (self-improving agent loop — see §4 and .harness/README.md)
pnpm harness:check    # 15 auto-checks; runs on every prebuild
pnpm harness:detect   # run the L2 inline detector against recent events
pnpm harness:digest   # generate today's digest + propose learnings.json edits
pnpm harness:apply    # apply a proposal under .harness/proposed/
pnpm harness:codemod  # invoke a codemod (e.g. inc-002-fastify-response --check file)
pnpm harness:test     # run codemod unit tests
```

Single-test invocation (from any package): `pnpm test path/to/spec.ts`.

## 3. High-level architecture

```text
.
├── apps/
│   ├── api/          NestJS 11 + Fastify adapter. Modules under src/modules/.
│   │                 Prisma 6 client lives here. Only app that may import Prisma.
│   └── web/          Next.js 15 App Router. UI in packages/ui, types in packages/contracts.
├── packages/
│   ├── contracts/    Zod schemas shared between api and web. Source of truth for
│   │                 request/response shapes. Touch this BEFORE schema.prisma.
│   ├── db/           Prisma client wrapper, migrations, seed helpers.
│   ├── ui/           shadcn/ui components + Tailwind 4 primitives.
│   └── config-{tsconfig,eslint,prettier}/  Shared toolchain config.
├── docs/
│   ├── decisions/    11 ADRs (ADR-001..011). Each is short and Nygard-formatted.
│   └── superpowers/  Optional planning artifacts (brainstorming → plans → review).
├── .harness/         Self-improving agent loop (capture → detect → digest → apply).
├── .openspec/        SDD workflow (proposal → approval → build → archive).
├── infra/            Dockerfiles, compose, observability collector config.
└── docker-compose.yml  Postgres + MailHog + OTel Collector for local dev.
```

**Request flow (web → api):** Next.js Server Component / Route Handler
imports a typed client from `packages/contracts` (which re-exports the
Zod schemas). The client calls the api over HTTP with a JWT from the
httpOnly cookie. The api validates with the same Zod schema via
`nestjs-zod`, hits Prisma, returns the typed response.

**Module boundaries (api):** each feature lives in
`src/modules/<feature>/` with `controller.ts`, `service.ts`,
`*.module.ts`, and `dto/` for Zod-input types. Cross-module imports
happen via the module's exported service, never via the database
directly.

## 4. Repo conventions unique to ai-padrao

These are the things you cannot infer from reading one file:

- **Conventional Commits are mandatory.** Scopes come from the
  allowlist in [`.commitlintrc.json`](.commitlintrc.json):
  `root`, `api`, `web`, `contracts`, `db`, `ui`, `config`, `docker`,
  `sdd`, `deps`. There is **no `harness` scope** — harness changes
  land under `root` or `deps`.
- **PRs that change behavior MUST reference an OpenSpec change** at
  `.openspec/changes/<feature>/`. `AGENTS.md` lists the only exceptions
  (cosmetic, dep bump, doc fix). Default to opening a change.
- **Architecture decisions are recorded as ADRs.** After fixing a bug
  and adding it to `.harness/INCIDENTS.md`, ask "is this pattern likely
  to recur?" — if yes, write an ADR alongside the INC entry. Format:
  see `docs/decisions/README.md`.
- **No skipped tests, anywhere.** Zero tolerance:
  `.harness/check.sh` (INC-012) scans every tracked `.ts/.tsx/.js/.jsx`
  for `.skip`, `.todo`, `xit`, `xdescribe`, `--passWithNoTests`, and
  vitest/jest `passWithNoTests` config. Failing this check fails the
  build. Do not silence a flaky test — fix it.
- **Harness inline detector is not advisory.** When the L2 detector
  surfaces a known INC pattern, **confirm with the user** that the
  pattern is intentional before continuing. Do not silently bypass.
  INC-017 (the docs-path filter) means writing `docs/decisions/*.md`
  will not trigger a false positive — but writing code that triggers
  INC-002/INC-003 is still a hard stop.
- **Auth tokens live in httpOnly cookies, never localStorage.** See
  AGENTS.md for the full list of forbidden actions.

## 5. Decision records

Open [`docs/decisions/README.md`](docs/decisions/README.md) first —
the index lists all 11 ADRs in one table. The three highest-traffic
ones (read these even if you read nothing else):

1. **ADR-007** — No skipped tests. Triggered every test you write.
2. **ADR-002** — Don't `import type` for Nest DI. Triggered every
   import refactor under `apps/api/`.
3. **ADR-006** — Use Nest `Logger`, not `console.*`. Triggered every
   edit to `apps/api/src/main.ts`.

When you change behavior, find the matching ADR and update both the
ADR and `.harness/INCIDENTS.md`. When you introduce a NEW decision
that doesn't fit any ADR, write a new one — see the "When to add a
new ADR" section in the index.

## 6. Editor / AI-assistant config

- **`.vscode/settings.json`** — Prettier as default formatter for
  TS/TSX/JSON/Markdown; ESLint flat config with explicit save-fix;
  TypeScript workspace TS locked to the repo's TS; Tailwind class
  regex includes `cN()` and `cn()` patterns from `packages/ui`.
  Format-on-save is **on** for all listed languages.
- **`.vscode/extensions.json`** — Recommended: ESLint, Prettier,
  Tailwind IntelliSense, Prisma, Docker, GitLens, Vitest Explorer,
  Copilot + Copilot Chat, Ruby LSP (Shopify). The Copilot Chat commit
  instructions are pre-loaded with the Conventional Commits + scope
  rules — you should not need to re-prompt them.
- **`.editorconfig`** — LF line endings, final newline, trim trailing
  whitespace. Matches Prettier defaults.
- **`AGENTS.md`** — The canonical rulebook for ALL AI assistants
  (Claude Code, Gemini CLI, Codex). Read it. It is stricter than this
  file on SDD, secrets, and the harness bypass prohibition.
- **`.github/copilot-instructions.md`** — Not present; AGENTS.md is
  the cross-tool source of truth.

## 7. Workflow expectations for Claude Code

When you are asked to make a behavior change:

1. **Read AGENTS.md first.** If you have not, you do not have context
   to act. The SDD rule applies even to "small" changes.
2. **Open an OpenSpec change** at
   `.openspec/changes/<feature>/` with the four required files
   (`proposal.md`, `tasks.md`, `design.md`, `specs/<area>/spec.md`).
   See `.openspec/AGENTS.md` §2 for the template and the §5 procedure
   to archive the change after merge.
3. **Stop and wait for human approval** on the proposal. Do not start
   tasks.md before approval lands.
4. **Execute tasks.md in order, one commit per task** using the
   Conventional Commits scope matching the file area. Reference the
   task number in the commit body.
5. **After merge, archive** per `.openspec/AGENTS.md` §5: move the
   spec delta to `.openspec/specs/<area>/<feature>.md`, append to
   `.openspec/CHANGELOG.md`, delete the change folder.

When the user asks for documentation-only work (CLAUDE.md, README,
ADRs, CONTRIBUTING, ARCHITECTURE), follow §10 of AGENTS.md: SDD is not
required, but Conventional Commits still apply. Use the `sdd` scope
for ADRs and `root` for the rest.

When in doubt about whether an action is forbidden, consult
AGENTS.md §"Forbidden actions" before acting. The harness detector
exists to catch the same violations at build time — if you would
upset the detector, ask the user first.
