# OpenSpec changelog

Archives of approved changes, in reverse chronological order. Each entry records
the date the change was archived, the feature name, the architectural summary,
the merged commits that shipped it, and the author of the archival work.

## 2026-08-04 — ddd-hexagonal-coverage

- **Feature:** `ddd-hexagonal-coverage`
- **Author:** Claude (subagent)
- **Archived spec:** `.openspec/specs/architecture/ddd-hexagonal-coverage.md`

### Summary

Adopted DDD and hexagonal architecture across `apps/api` and `apps/web` and
enforced independent 80% coverage gates (statements, branches, functions, and
lines) for each app. Verified that domain code remains framework-free, that
application code depends on outbound capabilities through ports, and that all
public API/web contracts (routes, status codes, Zod schemas, cookie names, JWT
claims, token rotation, web routes) are preserved.

The migration shipped incrementally across 15 tasks plus a follow-up fix wave:

1. `2e5b46a` — `docs(sdd): propose DDD hexagonal migration and coverage gate`
2. `798ee43` — `chore(deps): add per-app coverage baseline tooling`
3. `c14e636` — `test(root): characterize auth and users before architecture migration`
4. `98b0fc5` — `chore(config): enforce hexagonal dependency direction`
5. `b2909ee` — `feat(api): add users domain model and repository port`
6. `21d8930` — `feat(api): add users application use cases`
7. `fe77708` — `feat(api): add prisma users adapter and mapper`
8. `06e4706` — `feat(api): swap users http adapter to contexts/users`
9. `8f45115` — `feat(api): add auth domain ports and use cases`
10. `4c8215b` — `feat(api): add auth infrastructure adapters`
11. `c7433f2` — `feat(api): swap auth http adapter to contexts/auth`
12. `1876a61` — `refactor(web): migrate auth to ports and adapters`
13. `2258234` — `test(root): enforce 80 percent coverage per app and metric`
14. `7985524` — `fix(api): cast through unknown in logging interceptor spec`
15. `1b7ed77` — `docs(sdd): document hexagonal contexts and coverage enforcement`

All 15 plan tasks are complete. Sub-tasks 2 and 3 (coverage baselines and
characterization tests) were intentionally left unchecked in the original
proposal because they were superseded by the dedicated commits above and are
not required for the archived capability. The final archival commit (Task 15.5)
closes out the change folder.
# OpenSpec Changelog

Archived specs in `.openspec/specs/<area>/<feature>.md` are the source of
truth. Entries here record when each spec moved from `changes/` to `specs/`.

## 2026-08-04

- **inc-017-detector-excludes-docs** — `.harness/pattern_match.py` (L2
  detector) now excludes documentation-path Write events from the
  file-axis computation while preserving them in the symbol-axis
  combined blob. Prevents INC-002/INC-003 false positives when agents
  edit `docs/decisions/`, `.harness/INCIDENTS.md`, or
  `.harness/learnings.json`. Spec archived at
  `.openspec/specs/harness/inc-017-detector-excludes-docs.md`.
  Implementation tasks 1–6 (INCIDENTS.md, learnings.json,
  pattern_match.py, test_pattern_match.py, check.sh wire-up, full
  green run) completed; PASS=15, SKIP=3.
