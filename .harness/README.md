# Harness

> The **harness** is the system that wraps AI agents working on this project. It captures what we've learned, prevents re-introducing known defects, and evolves as we encounter new failure modes.

This directory is the **memory of the harness** — durable artifacts that persist across agent sessions.

## Files

| File | Purpose | Format |
|---|---|---|
| `INCIDENTS.md` | Narrative log of every real defect that escaped review | Markdown, dated, one section per incident |
| `learnings.json` | Structured queryable database mapping patterns to prevention rules | JSON, machine-readable |
| `README.md` | This file | Markdown |

## The learning loop

```
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

## How to use the harness

### Before starting work

1. Read recent entries in `INCIDENTS.md` (skim the last 5).
2. For each, check if your planned change touches the same area. If yes, invoke the matching skill (`nestjs-fastify-gotchas`, `pnpm-monorepo-script-pitfalls`, etc.).

### After fixing a bug

1. Add an entry to `INCIDENTS.md` with: symptom, root cause, fix, prevention rule.
2. Update `learnings.json` with structured `trigger_pattern` + `prevention` metadata.
3. If the prevention is weak, strengthen it (see [harness-self-improvement](~/.claude/skills/harness-self-improvement/SKILL.md)).

### Every ~10 incidents

Run the [harness-self-improvement](~/.claude/skills/harness-self-improvement/SKILL.md) skill:
- Detect patterns across the incident log
- Promote frequent patterns to AGENTS.md / lint configs
- Strengthen weak preventions (skills → lint rules)
- Update the `last_updated` in `learnings.json`

## Current state (as of 2026-08-04)

| Metric | Value |
|---|---|
| Total incidents logged | 11 |
| With skill prevention | 11 (100%) |
| With auto_check (machine-verifiable) | 8 (73%) |
| Categories covered | 7 distinct |
| Skills referenced | 2 (`nestjs-fastify-gotchas`, `pnpm-monorepo-script-pitfalls`) |
| Skills to create | 0 (no gap detected) |

## Coverage map

| Category | Skill | Auto-checks |
|---|---|---|
| platform-dep (INC-001) | nestjs-fastify-gotchas | package_json_dep |
| api-compat (INC-002) | nestjs-fastify-gotchas | grep_audit |
| decorator-metadata (INC-003) | nestjs-fastify-gotchas | lint_rule_override |
| prisma-config (INC-004) | pnpm-monorepo-script-pitfalls | package_json_field |
| auth-guard (INC-005) | nestjs-fastify-gotchas | e2e_test |
| dockerfile-order (INC-006) | pnpm-monorepo-script-pitfalls | dockerfile_lint |
| eslint-config (INC-007) | pnpm-monorepo-script-pitfalls | grep_audit |
| port-collision (INC-008) | pnpm-monorepo-script-pitfalls | compose_lint |
| logger-pattern (INC-009) | nestjs-fastify-gotchas | grep_audit |
| peer-warning (INC-010) | docs only | — |
| vite-cjs (INC-011) | env_var | grep_audit |

All 11 incidents have prevention rules. 8 of 11 are machine-verifiable.

## What this is NOT

- **Not a CI pipeline.** The auto_checks listed in `learnings.json` are *specifications* of what should be checked. Wiring them into actual CI is a separate task — see suggested_agent_rule_updates in `learnings.json`.
- **Not a replacement for tests.** Unit, integration, and e2e tests remain the primary verification layer. The harness captures *meta-lessons* (how to prevent whole categories of bugs), not individual test cases.
- **Not a substitute for code review.** The harness tells future agents what to watch for; humans and reviewers still decide if the fix is correct.

## Related skills

- [monorepo-dod-validation](~/.claude/skills/monorepo-dod-validation/SKILL.md) — the 12-step validation that surfaces incidents
- [fix-wave-orchestration](~/.claude/skills/fix-wave-orchestration/SKILL.md) — the dispatch loop during stabilization
- [harness-self-improvement](~/.claude/skills/harness-self-improvement/SKILL.md) — meta-skill that evolves the harness itself
- [nestjs-fastify-gotchas](~/.claude/skills/nestjs-fastify-gotchas/SKILL.md) — example of a skill born from incidents
- [pnpm-monorepo-script-pitfalls](~/.claude/skills/pnpm-monorepo-script-pitfalls/SKILL.md) — example of a skill born from incidents
