# ADR-009 — `.harness/events/` is gitignored (per-session state, not source of truth)

- **Status:** Accepted
- **Date:** 2026-08-04
- **Incident reference:** INC-014 (full context in `.harness/INCIDENTS.md`)

## Context

`.harness/events/` accumulates one NDJSON file per session — typically
hundreds of files of streamed tool calls. The directory is hot, written
on every Claude Code invocation, and the file rotation is meaningless
for code review (no one reads another developer's event log). It is
**session state**, not project state. Checking it in bloats `git clone`
by megabytes, makes `git status` noisy on every command, and risks
leaking local paths into the shared history.

`.harness/INCIDENTS.md` and `.harness/learnings.json` ARE source of
truth and remain tracked.

## Decision

`.harness/events/` MUST be in `.gitignore` at the repo root. The
`learnings.json` is the canonical, hand-curated summary of what
matters; the event log is only the daily-digest input and the
debug-the-detector tool. Both files exist outside `events/`:

```gitignore
# .gitignore
.harness/events/
```

`.harness/digest/` is gitignored too (per-day review notes, also
session-scoped). The codemods and capture scripts remain tracked.

## Consequences

- **Easier:** `git clone` is fast; `git status` is quiet; nothing in
  the shared history contains local paths or session metadata.
- **Harder:** A developer who wants their session's event log shipped
  for debugging must tar it explicitly and attach it to a ticket.
- **Trade-off:** Accept — git history is for decisions, not streams.

## Enforcement

- Auto-check **INC-014** in `.harness/check.sh` greps `.gitignore` for
  `.harness/events` and fails if missing. (`.harness/digest/` is checked
  by INC-015 freshness, not by a gitignore entry.)
- The daily digest agent (`pnpm harness:digest`) reads from
  `.harness/events/` regardless of gitignore status — the ignore only
  affects tracking, not runtime access.
