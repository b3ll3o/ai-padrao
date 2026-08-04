# Codemods — feedforward guides (Alura: "guias")

> **Alura conceito:** o agente = modelo + harness. O harness é formado por **guias** (que dizem à agente o que fazer ANTES do erro) e **sensores** (que detectam o erro DEPOIS). Codemods são guias: transformações determinísticas que o assistente pode invocar no momento de editar um arquivo, antes de introduzir um padrão sabidamente defeituoso.

Codemods are **pre-emptive transformations**: given an INC pattern from [`.harness/INCIDENTS.md`](../INCIDENTS.md) and [`.harness/learnings.json`](../learnings.json), each codemod converts a known anti-pattern into its safe equivalent. They run as **string-level rewrites** (no AST dependency — no `ts-morph`, no `babel`) because the patterns we care about are regular enough to match with `re.sub` and human reviewable enough to verify by eye.

## Why codemods (not just lint rules)

- **Linter rules block** — they say "you can't commit this." Codemods **fix** — they say "this is the safe form, here it is, apply it."
- **Linter rules are reactive** (fail after the fact). Codemods are **feedforward** (applied before the agent commits the bad pattern).
- Many INC patterns are not "always wrong" — e.g. `console.log` is fine in `*.spec.ts` but not in `main.ts`. A codemod can scope its transformation tightly; a regex-only lint rule can't.

## When to invoke

- **Before an Edit/Write** that touches a file listed in any `INC-XXX.trigger_pattern.files` (the inline detector — see INC-006, INC-002, etc. in `learnings.json`).
- **During a fix wave** — when applying the prevention for a recurring INC, run the codemod across the codebase to eliminate every existing instance.
- **After INC-XXX is added** — the next fix wave creates a codemod for it as part of the prevention layer.

## Why no AST

The patterns are regular (`res.setHeader(`, `console.log(`, `import type { … } from`). Regex with manual context checks is enough, faster than `ts-morph`, and avoids a new dependency. If a pattern stops being regex-friendly, **add a codemod test** first; only then consider an AST library.

## Layout

```
codemods/
  README.md                   # this file
  run.sh                      # thin wrapper: codemod --check | codemod --apply
  inc-002-fastify-response.py # INC-002: res.setHeader / res.cookie → reply.header / reply.setCookie
  inc-003-nest-di-imports.py  # INC-003: split `import type` for DI'd classes from type-only imports
  inc-006-dockerfile-order.py # INC-006: ensure COPY apps/api precedes RUN prisma generate
  inc-009-nest-logger.py      # INC-009: console.log / console.warn → new Logger(...).log / .warn
```

Each codemod:

- **Is stdlib-only** (no `pip install`).
- **Reads from stdin or a file path argument.**
- **Supports `--check` (dry-run, prints diff) and `--apply` (writes back).**
- **Exits 0 when no changes are needed, 1 on error, 2 on check-mode changes-needed-but-not-applied.**
- **Has a unit test** (file under `tests/` in the same dir) that exercises the transform.

## How the assistant should invoke

```text
$EDITOR .harness/codemods/inc-002-fastify-response.py --check apps/api/src/modules/audit/audit.interceptor.ts
# → shows unified diff for the proposed rewrite
$EDITOR .harness/codemods/inc-002-fastify-response.py --apply apps/api/src/modules/audit/audit.interceptor.ts
# → writes the safe form
```

The wrapper `run.sh` adds JSONL tracing so the inline detector (L2) can observe codemod invocations and correlate them with the matching INC pattern.
