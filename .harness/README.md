# Harness

> The **harness** is the system that wraps AI agents working on this project. It captures what we've learned, prevents re-introducing known defects, and evolves as we encounter new failure modes.

This directory is the **memory of the harness** — durable artifacts that persist across agent sessions.

## Files

| File                    | Purpose                                                                                 | Format                                    |
| ----------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------- |
| `INCIDENTS.md`          | Narrative log of every real defect that escaped review                                  | Markdown, dated, one section per incident |
| `learnings.json`        | Structured queryable database mapping patterns to prevention rules                      | JSON, machine-readable                    |
| `check.sh`              | L4 enforcement — runs every auto-check before every build                               | Bash, exits non-zero on failure           |
| `capture.sh`            | L1 capture — appends one NDJSON line per Claude Code tool call                          | Bash + python3 stdlib                     |
| `detect.sh`             | L2 inline detector — pipes recent events through `pattern_match.py`                     | Bash + python3 stdlib                     |
| `pattern_match.py`      | The matching algorithm (file-axis + symbol-axis)                                        | Python 3 stdlib only                      |
| `digest.py`             | L3 daily digest — aggregates events into one markdown + proposes `learnings.json` edits | Python 3 stdlib only                      |
| `codemods/`             | Feedforward transformations for known-safe rewrites (`inc-002-fastify-response`, etc.)  | Python 3 stdlib only                      |
| `test_pattern_match.py` | Regression tests for INC-017 docs-path filter                                           | Python 3 stdlib `unittest`                |
| `README.md`             | This file                                                                               | Markdown                                  |

## The learning loop

```text
real defect ──→ INCIDENTS.md ──→ learnings.json ──→ prevention rule ──→ blocks reincarnation
                  (narrative)      (structured)       (skill/lint/test)        ↓
                                                                         AGENTS.md / lint config
                                                                         prebuild script
                                                                         new skill
                                                                         e2e test
                                                                         ↓
                                                                  confirmed working in CI
```

Every time the harness blocks a known defect, that's a success. Every time a new defect sneaks through, add an entry and iterate.

## The four layers

| Layer                  | What it does                                                                          | Where it lives                                                     |
| ---------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **L1 — Capture**       | Append one JSONL line per tool call (after `redact.py`)                               | `.harness/capture.sh` + `~/.claude/settings.json` PostToolUse hook |
| **L2 — Inline detect** | Compare last 20 events against `learnings.json`; match → blocking confirmation prompt | `.harness/detect.sh` + `.harness/pattern_match.py`                 |
| **L3 — Daily digest**  | Aggregate events → markdown digest + proposed patch                                   | `.harness/digest.py` (CronCreate @ 22:03 local)                    |
| **L4 — Enforce**       | All 15 auto-checks (`INC-001`..`INC-017`) before every build                          | `.harness/check.sh` (wired into `pnpm prebuild`)                   |

The model is **agente = modelo + harness** — the agent is the model plus the
harness around it. The harness has two halves:

- **Guias (feedforward):** tell the agent the safe form BEFORE it writes
  the bad form. Codemods in `.harness/codemods/` are guias.
- **Sensores (feedback):** observe what the agent did and surface it.
  L1, L2, L3, L4 are sensores.

## How to use the harness

### Before starting work

1. Read recent entries in `INCIDENTS.md` (skim the last 5).
2. For each, check if your planned change touches the same area. If yes,
   invoke the matching skill (`nestjs-fastify-gotchas`,
   `pnpm-monorepo-script-pitfalls`).

### After fixing a bug

1. Add an entry to `INCIDENTS.md` with: symptom, root cause, fix,
   prevention rule.
2. Update `learnings.json` with structured `trigger_pattern` +
   `prevention` metadata.
3. If the prevention is weak, strengthen it (see
   `harness-self-improvement`).

### Every ~10 incidents

Run the `harness-self-improvement` skill:

- Detect patterns across the incident log
- Promote frequent patterns to `AGENTS.md` / lint configs
- Strengthen weak preventions (skills → lint rules)
- Update `last_updated` in `learnings.json`

## Current state (as of 2026-08-04)

| Metric                               | Value                                                         |
| ------------------------------------ | ------------------------------------------------------------- |
| Total incidents logged               | 17 (INC-001..INC-017)                                         |
| With skill prevention                | 13 (76%)                                                      |
| With policy prevention               | 17 (100%)                                                     |
| With auto_check (machine-verifiable) | 15 (88%)                                                      |
| Categories covered                   | 12 distinct                                                   |
| Skills referenced                    | 2 (`nestjs-fastify-gotchas`, `pnpm-monorepo-script-pitfalls`) |
| Auto-checks wired into `check.sh`    | 15 PASS / 0 FAIL / 3 SKIP                                     |
| Last harness self-improvement        | 2026-08-04 (INC-017)                                          |

## Coverage map

| Category                       | Skill                             | Auto-check                | Status                          |
| ------------------------------ | --------------------------------- | ------------------------- | ------------------------------- |
| `platform-dep` (INC-001)       | `nestjs-fastify-gotchas`          | `package_json_dep`        | PASS                            |
| `api-compat` (INC-002)         | `nestjs-fastify-gotchas`          | `grep_audit`              | PASS                            |
| `decorator-metadata` (INC-003) | `nestjs-fastify-gotchas`          | `lint_rule_override`      | SKIP (manual per-file analysis) |
| `prisma-config` (INC-004)      | `pnpm-monorepo-script-pitfalls`   | `package_json_field`      | PASS                            |
| `auth-guard` (INC-005)         | `nestjs-fastify-gotchas`          | `grep_audit`              | PASS                            |
| `auth-guard-e2e` (INC-005)     | `nestjs-fastify-gotchas`          | `e2e_test`                | SKIP (requires jest run)        |
| `dockerfile-order` (INC-006)   | `pnpm-monorepo-script-pitfalls`   | `dockerfile_lint`         | PASS                            |
| `eslint-config` (INC-007)      | `pnpm-monorepo-script-pitfalls`   | `grep_audit`              | PASS                            |
| `port-collision` (INC-008)     | `pnpm-monorepo-script-pitfalls`   | `compose_lint`            | PASS                            |
| `logger-pattern` (INC-009)     | `nestjs-fastify-gotchas`          | `grep_audit`              | PASS                            |
| `peer-warning` (INC-010)       | —                                 | docs only                 | SKIP (acceptable upstream)      |
| `vite-cjs` (INC-011)           | `env_var`                         | `grep_audit`              | PASS                            |
| `test-discipline` (INC-012)    | `AGENTS.md §No skipped tests`     | `grep_audit`              | PASS                            |
| `capture-deps` (INC-013)       | `AGENTS.md §Capture deps`         | `grep_audit`              | PASS                            |
| `events-transient` (INC-014)   | `AGENTS.md §Events transient`     | `gitignore_check`         | PASS                            |
| `digest-freshness` (INC-015)   | `AGENTS.md §Digest freshness`     | `digest_mtime`            | PASS                            |
| `secret-leak` (INC-016)        | `AGENTS.md §No plaintext secrets` | `grep_audit`              | PASS                            |
| `detector-design` (INC-017)    | `AGENTS.md §Continuous learning`  | `unittest` + `grep_audit` | PASS                            |

**Totals:** 17 INCs → 15 auto-checked, 2 manual/e2e (`INC-005 e2e`,
`INC-003 per-file`), 1 accepted warning (`INC-010` upstream). The
machine-verifiable count is 15/17 = 88%; with the e2e check run in
CI it would be 16/17 = 94%.

## What this is NOT

- **Not a CI pipeline.** The auto_checks listed in `learnings.json`
  are _specifications_ of what should be checked. Wiring them into
  actual CI is a separate task — see `suggested_agent_rule_updates` in
  `learnings.json`.
- **Not a replacement for tests.** Unit, integration, and e2e tests
  remain the primary verification layer. The harness captures
  _meta-lessons_ (how to prevent whole categories of bugs), not
  individual test cases.
- **Not a substitute for code review.** The harness tells future
  agents what to watch for; humans and reviewers still decide if the
  fix is correct.

## Related skills

- `monorepo-dod-validation` — the 12-step validation that surfaces
  incidents.
- `fix-wave-orchestration` — the dispatch loop during stabilization.
- `harness-self-improvement` — meta-skill that evolves the harness
  itself.
- `nestjs-fastify-gotchas` — example of a skill born from incidents.
- `pnpm-monorepo-script-pitfalls` — example of a skill born from
  incidents.

## When to extend the harness

Add a new INC + learning entry whenever:

- The same defect pattern is fixed twice (prevention was too weak).
- A reviewer catches something the auto-checks missed (new pattern).
- A new dependency version introduces a new failure mode.

Avoid extending when:

- The bug is a one-off (typo, off-by-one). Add a test, not a rule.
- The prevention rule would slow every commit for a marginal benefit.
  Prefer a skill over an auto-check unless the cost of skipping is
  high.
