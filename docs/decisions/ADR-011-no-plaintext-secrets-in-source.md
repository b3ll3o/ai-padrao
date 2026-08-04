# ADR-011 — No plaintext tokens in tracked source

- **Status:** Accepted
- **Date:** 2026-08-04
- **Incident reference:** INC-016 (full context in `.harness/INCIDENTS.md`)

## Context

Real API keys leaked into a tracked `.env.example` rewrite during the
ai-padrao stabilization wave. The pattern looked like an example value
(`sk-ant-api03-EXAMPLE…`) and survived code review; the actual leak
came from a copy-paste from a different project's `.env`. Once in git
history, secret rotation is the only remediation — git filter-branch is
not safe for shared repositories.

Heuristic detection covers the well-known shapes (Anthropic, GitHub
PAT, OpenAI, AWS access-key) without false-positive risk on common
strings. The detection runs at build time, before push, so the leak
never reaches `origin`.

## Decision

Tracked source under `apps/` and `packages/` MUST NOT contain
hardcoded tokens matching the shape of:

- `sk-ant-…`, `sk-cp-…` (Anthropic)
- `ghp_…`, `github_pat_…` (GitHub)
- `sk-…` of length ≥ 32 (OpenAI)
- `AKIA…` of length 20 (AWS access key id)

Test fixtures (`*.spec.ts`, `*.test.ts`, `*.mock.ts`, `*.fixture.ts`)
are excluded by file path; env files (`.env`, `.env.example`) are
excluded by `.gitignore` and never scanned.

Secrets belong in `.env` (which is gitignored) or a runtime secret
store. They MUST be referenced via `process.env.NAME` or a typed
config loader, never interpolated into source.

## Consequences

- **Easier:** Common secret leaks fail the build instead of the post-
  mortem. The check is fast (single `grep -rE`).
- **Harder:** A new token shape requires updating the regex list
  before the new shape can be checked in.
- **Trade-off:** Accept — secret-rotation cost is vastly higher than
  the maintenance cost of a regex list.

## Enforcement

- Auto-check **INC-016** in `.harness/check.sh` runs the regex grep
  over `apps/` and `packages/` (with the documented exclusions) and
  fails on any hit. Output shows the file and line for each match.
- `AGENTS.md §No plaintext secrets` is the human-facing rule.
- A documented follow-up (not yet an INC): expand detection to
  Stripe (`sk_live_…`, `rk_live_…`) and SendGrid (`SG.…) shapes.
