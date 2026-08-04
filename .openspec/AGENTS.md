# OpenSpec Workflow — Detailed Agent Guide

This file is the canonical reference for the SDD workflow enforced in this repo. AI agents and humans both follow it.

## When to use OpenSpec

**Use OpenSpec for:**

- Any new feature (user-visible or internal)
- Any change to existing behavior (endpoints, UI flows, business rules, data shape)
- Any change to public contracts (API surface, database schema, shared types)

**Do NOT use OpenSpec for:**

- Bug fixes where the spec already correctly describes the intended behavior (just fix the bug)
- Cosmetic changes (typos, formatting, refactors with no behavior impact)
- Dependency version bumps without behavior change
- Documentation-only updates

If unsure, **default to using OpenSpec** — the cost of an extra proposal is much lower than the cost of an unauthorized behavior change.

## The five steps

### 1. Problem framing

Before opening a proposal, answer in one paragraph:

- **What is the problem?** (User-facing symptom or internal gap)
- **Who is affected?** (Which users / systems)
- **Why now?** (Why this is the right time to fix it)

### 2. Proposal

Create `.openspec/changes/<feature-name>/` with these four files:

#### `proposal.md`

Must contain these sections (in this order):

- **Why** — the problem and the value of solving it
- **What changes** — concrete list of user-visible or system-visible effects
- **Impact** — broken down by:
  - Users (UX changes, new flows)
  - System (new endpoints, new tables, new env vars)
  - Other features (anything that depends on what's changing)
- **Out of scope** — explicit list of what this proposal will NOT touch
- **Risks** — at least one risk with its mitigation

#### `tasks.md`

Numbered, executable checklist. Each item MUST have a clear Definition of Done. Order tasks so each one is independently verifiable.

Example:
```
- [ ] 1. Add `Foo` model to Prisma schema
      DoD: `prisma migrate dev` creates the table
- [ ] 2. Implement `FooService.create()`
      DoD: Unit test `foo.service.spec.ts` passes
```

#### `design.md`

Technical decisions that need explanation. Examples:

- Choice of library (and what was rejected)
- Data shape decisions (why a JSON column vs a separate table)
- Performance trade-offs
- Security considerations

Skip `design.md` only if the proposal is so small that there's nothing to explain (e.g., adding a single endpoint).

#### `specs/<area>/spec.md`

A delta document using **SHALL/SHOULD/MAY** (RFC 2119). Each requirement is one line:

```
WHEN a user requests password reset,
THE system SHALL send an email containing a unique link valid for 1 hour,
AND the link SHALL expire after first use.
```

Keep it short, testable, unambiguous.

### 3. Review

The proposal is **NOT** approved until a human explicitly says so. AI agents MUST wait for this approval before any code change.

### 4. Build

Execute the tasks in order. Each task = one commit (Conventional Commits format):

```
feat(api): task 1 - add PasswordResetToken model
feat(api): task 2 - generate migration
feat(api): task 3 - add Zod schemas for password reset
```

Reference the task number in the commit body so reviewers can map commits → checklist.

### 5. Archive

After the PR is merged:

1. Move `.openspec/changes/<feature-name>/specs/<area>/spec.md` to `.openspec/specs/<area>/<feature-name>.md`
2. Add a brief entry to `.openspec/CHANGELOG.md` (date, feature, author)
3. Delete the rest of the change folder

Git preserves history. The archived spec becomes the new source of truth for that feature.

## Templates

See [`.openspec/templates/`](templates/) for starter files.

## Working in derived projects

When you clone this repo to start a new project:

1. Update `package.json` → `name`, `description`, `version`
2. Update `.env.example` → secrets, project name
3. Update `README.md` → project name + quickstart
4. **Keep `AGENTS.md` and `.openspec/` intact** — they are the rule, not the content
