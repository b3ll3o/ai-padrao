# CLAUDE.md

> **Canonical location:** `.agents/CLAUDE.md`. The project follows a single
> `.agents/` standard; there is no `CLAUDE.md` or `.claude/` directory at
> the repo root — see [`.agents/README.md`](README.md) for the layout and
> the tool-discovery rules.

Guidance for Claude Code (claude.ai/code) when working in this repository.
The project-wide AI-assistant rulebook lives in [`AGENTS.md`](AGENTS.md);
this file only covers Claude-Code-specific orientation.

## Configuring Claude Code to find skills under `.agents/skills/`

Claude Code scans `~/.claude/skills/` (user) and `.claude/skills/`
(project) by default. This project keeps skills under
[`.agents/skills/`](skills/) instead. To make Claude Code find them in
this repo, add `.agents/skills` to your machine-level
`~/.claude/settings.json` under `skillsPaths`, or set the environment
variable `CLAUDE_CODE_SKILLS_PATH=.agents/skills` before launching
Claude Code. See [`.agents/README.md`](README.md) for the full
discovery rationale.

## 1. Project identity

This repo is **`ai-padrao`**, a monorepo blueprint for SDD-driven
full-stack apps: Next.js 15 (web) and NestJS 11 / Fastify (api) and
Prisma 6 and Postgres, all wired through pnpm 9 workspaces and
Turborepo 2. It is a **blueprint** — conventions and ADRs are
first-class deliverables, not just incidental source. The reader
is expected to copy the shape and adapt the content.

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
pnpm build            # turbo run build
pnpm lint             # turbo run lint
pnpm typecheck        # turbo run typecheck
pnpm test             # turbo run test (vitest, unit + e2e)
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
│   ├── decisions/    ADRs (ADR-001..). Each is short and Nygard-formatted.
│   └── superpowers/  Optional planning artifacts (brainstorming → plans → review).
├── .openspec/        SDD workflow (proposal → approval → build → archive).
├── .githooks/        Local pre-push + post-merge gates.
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
  `sdd`, `deps`.
- **PRs that change behavior MUST reference an OpenSpec change** at
  `.openspec/changes/<feature>/`. `AGENTS.md` lists the only exceptions
  (cosmetic, dep bump, doc fix). Default to opening a change.
- **Architecture decisions are recorded as ADRs.** When you introduce
  a NEW decision that doesn't fit any ADR, write a new one — see the
  "When to add a new ADR" section in `docs/decisions/README.md`.
- **No skipped tests, anywhere.** Zero tolerance — see AGENTS.md
  §"No skipped tests" for the full rule.
- **Auth tokens live in httpOnly cookies, never localStorage.** See
  AGENTS.md for the full list of forbidden actions.

## 5. Decision records

Open [`docs/decisions/README.md`](docs/decisions/README.md) first —
the index lists all ADRs in one table. The three highest-traffic
ones (read these even if you read nothing else):

1. **ADR-007** — No skipped tests. Triggered every test you write.
2. **ADR-002** — Don't `import type` for Nest DI. Triggered every
   import refactor under `apps/api/`.
3. **ADR-006** — Use Nest `Logger`, not `console.*`. Triggered every
   edit to `apps/api/src/main.ts`.

When you change behavior, find the matching ADR and update it.

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
  file on SDD and secrets.
- **`.github/copilot-instructions.md`** — Not present; AGENTS.md is
  the cross-tool source of truth.

## 7. Workflow expectations for Claude Code

When you are asked to make a behavior change:

1. **Read AGENTS.md first.** If you have not, you do not have context
   to act. The SDD rule applies even to "small" changes.
2. **Open an OpenSpec change** at
   `.openspec/changes/<feature>/` with the four required files
   (`proposal.md`, `tasks.md`, `design.md`, `specs/<area>/spec.md`).
   See `.agents/sdd/AGENTS.md` §2 for the template and the §5 procedure
   to archive the change after merge.
3. **Stop and wait for human approval** on the proposal. Do not start
   tasks.md before approval lands.
4. **Execute tasks.md in order, one commit per task** using the
   Conventional Commits scope matching the file area. Reference the
   task number in the commit body.
5. **After merge, archive** per `.agents/sdd/AGENTS.md` §5: move the
   spec delta to `.openspec/specs/<area>/<feature>.md`, append to
   `.openspec/CHANGELOG.md`, delete the change folder.

When the user asks for documentation-only work (`.agents/CLAUDE.md`,
`README.md`, ADRs, `CONTRIBUTING.md`, `ARCHITECTURE.md`), follow §10 of
`AGENTS.md`: SDD is not required, but Conventional Commits still apply. Use
the `sdd` scope
for ADRs and `root` for the rest.

When in doubt about whether an action is forbidden, consult
AGENTS.md §"Forbidden actions" before acting.
