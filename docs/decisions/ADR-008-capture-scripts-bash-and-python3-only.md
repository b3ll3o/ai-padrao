# ADR-008 — Capture scripts use bash + python3 only (no `jq`, no new top-level deps)

- **Status:** Accepted
- **Date:** 2026-08-04
- **Incident reference:** INC-013 (full context in `.harness/INCIDENTS.md`)

## Context

`.harness/capture.sh`, `.harness/detect.sh`, `.harness/digest.sh`, and
`.harness/pattern_match.py` run on every Claude Code event (capture) and
on every build (detect). The existing prettier PostToolUse hook used
`jq` and silently no-op'd on machines without it — meaning the harness
captured nothing for entire sessions. We didn't notice until a digest
review showed zero events for a week.

The capture/detect scripts are first-party hooks. They cannot depend on
a package manager having already run, on a binary that may or may not
be installed by the user's distro, or on a third-party Python package
that requires `pip install`. They MUST work with stock Python 3 (stdlib
only) and stock bash. New top-level binary deps are not allowed.

## Decision

`.harness/{capture,detect,digest}.sh` and `.harness/pattern_match.py`
MUST run with only `bash` and `python3` (3.10+) on the host. JSON
processing is done with `python3 -c` or `json`/`json.tool`/`re`. No
`jq`, no `yq`, no `fzf`, no `ripgrep`. Python stdlib only — no
`requests`, no `pyyaml`, no `tomllib`-from-future-imports-bleeding
workarounds.

If a feature genuinely needs a third-party tool, it belongs in a
Codemod or a one-shot script under `.harness/codemods/`, NOT in the
hot-path capture/detect chain.

## Consequences

- **Easier:** Capture works on every developer machine from a fresh
  install. Silent no-ops stop happening.
- **Harder:** We re-implement things `jq` would give for free
  (specifically: JSON pretty-printing and field extraction). The cost
  is small (10 lines of Python) and the correctness is provable.
- **Trade-off:** Accept — silent no-op hooks are the worst failure mode
  for a learning loop.

## Enforcement

- Auto-check **INC-013** in `.harness/check.sh` greps the four capture
  files for `jq` (and other forbidden binaries) and fails on any match.
- Codemods may use `jq` for ad-hoc inspection — they are developer
  tools, not hot-path hooks.
