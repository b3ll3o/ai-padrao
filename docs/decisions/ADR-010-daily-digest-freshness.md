# ADR-010 — Daily digest must be fresh (< 25h old)

- **Status:** Accepted
- **Date:** 2026-08-04
- **Incident reference:** INC-015 (full context in `.harness/INCIDENTS.md`)

## Context

The harness learns in a loop: events are captured → detector matches
patterns → daily digest surfaces recurring issues → learnings.json is
updated. If the daily digest stops running, the loop silently breaks:
the detector may still fire, but no human (or AI) reviews the output,
no new INC entries are drafted, and `learnings.json` freezes. Two weeks
later a new contributor hits an INC that's been latent for ten days,
and the harness has no answer.

The "is the digest running?" question cannot be asked of `learnings.json`
directly — it stays valid even when the digest dies. We need a separate
liveness signal.

## Decision

`.harness/digest/` MUST contain at least one `*.md` file whose mtime is
within the last 25 hours. If no such file exists, the harness has
stopped learning and `pnpm harness:check` MUST fail with a message
pointing the developer at `pnpm harness:digest`.

The 25-hour window (instead of a strict 24) tolerates timezone
boundaries and a missed run on a Sunday. A missed day is recoverable;
two missed days is a build-blocker.

```bash
# INC-015 check (in .harness/check.sh)
latest=$(find .harness/digest -maxdepth 1 -type f -name "*.md" \
  -printf "%T@\n" | sort -n | tail -1)
[ -n "$latest" ] && [ "$(( $(date +%s) - ${latest%.*} ))" -le 90000 ]
```

## Consequences

- **Easier:** A dead daily-agent shows up as a build failure, not as a
  silent knowledge gap two weeks later.
- **Harder:** A developer who hasn't run `pnpm harness:digest` in 25h
  sees a red CI. (The fix is one command.)
- **Trade-off:** Accept — silent learning-loop death is the failure
  mode this rule exists to catch.

## Enforcement

- Auto-check **INC-015** in `.harness/check.sh` (the snippet above).
- `AGENTS.md §Digest freshness` documents the 25h window and the
  remediation command for humans.
- A follow-up check (not yet an INC) should surface if
  `events/` itself has been empty for the digest window — silent
  capture failure is the upstream cause.
