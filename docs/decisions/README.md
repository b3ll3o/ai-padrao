# Architecture Decision Records

This directory contains the Architecture Decision Records (ADRs) for
`ai-padrao`. ADRs capture the **why** behind the big choices so that future
contributors (human or AI) can understand the trade-offs without having to
re-derive them.

## How to read these

Each ADR follows a common template:

- **Status / Date / Decision type** — `Accepted`, `Proactive` (proposed
  before any incident), `Reactive` (proposed in response to an
  `INC-XXX`), or `Superseded`.
- **Context** — the situation that called for a decision.
- **Decision** — the choice we made.
- **Consequences** — positive outcomes and trade-offs.
- **Enforcement** — what makes the decision stick (build rules, harness
  checks, docs).

## Index

| ID      | Title                                                                                                 | Status   | Date       | Type      |
| ------- | ----------------------------------------------------------------------------------------------------- | -------- | ---------- | --------- |
| ADR-012 | [Vertical bounded contexts with inward-pointing dependencies](./ADR-012-vertical-bounded-contexts.md) | Accepted | 2026-08-04 | Proactive |
| ADR-013 | [Independent 80% coverage gate per app and per metric](./ADR-013-independent-80-percent-coverage.md)  | Accepted | 2026-08-04 | Proactive |

## Adding a new ADR

1. Pick the next ID (`ADR-014`, `ADR-015`, …). Do not reuse IDs.
2. Create `docs/decisions/ADR-NNN-kebab-case-title.md`.
3. Use the Context / Decision / Consequences / Enforcement template.
4. Set the **Decision type** accurately:
   - **Proactive** — proposed before any incident. No `INC-XXX` reference.
   - **Reactive** — proposed in response to an incident. Reference the
     `INC-XXX` ID from [`.harness/INCIDENTS.md`](../.harness/INCIDENTS.md).
5. Add a row to the table above with ID, title (linked), status, date, type.
6. Commit on a Conventional Commits scope that matches the surface
   (`sdd` for workflow/docs, `api` or `web` for app-specific, `root` or
   `config` for cross-cutting).

## Related

- [`AGENTS.md`](../AGENTS.md) — global guardrails, including SDD, the
  no-skipped-tests policy, and the four-layer harness model.
- [`.harness/INCIDENTS.md`](../.harness/INCIDENTS.md) — the incident log
  that drives reactive ADRs and harness auto-checks.
- [`.openspec/AGENTS.md`](../.openspec/AGENTS.md) — the SDD workflow that
  produces the proposals ADRs often reference.
