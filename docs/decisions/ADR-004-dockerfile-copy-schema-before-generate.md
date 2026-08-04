# ADR-004 — Dockerfile: copy prisma schema BEFORE `prisma generate`

- **Status:** Accepted
- **Date:** 2026-08-04
- **Incident reference:** INC-006 (full context in `.harness/INCIDENTS.md`)

## Context

`prisma generate` reads `apps/api/prisma/schema.prisma` from the build
context. If the `COPY apps/api ./apps/api` line comes AFTER the
`RUN pnpm --filter … exec prisma generate` line, the schema is not in
the image at generate-time. The error is loud on a clean rebuild:
"Could not find Prisma Schema that is required for this command" — but
often missed because CI cached layers from a previous successful build,
and the running container starts up just fine.

## Decision

The Dockerfile for any service that runs `prisma generate` during the
build MUST place the schema in the build context BEFORE the generate
step. The canonical shape:

```dockerfile
COPY apps/api/prisma ./apps/api/prisma    # schema first
RUN pnpm --filter @ai-padrao/api exec prisma generate
COPY apps/api ./apps/api                  # rest of the app
```

For new Dockerfiles, follow this exact ordering. For existing ones, the
auto-check below will surface the bug.

## Consequences

- **Easier:** Cold-cache builds work; image rebuilds from a clean state
  succeed.
- **Harder:** Slightly larger intermediate layer (the schema copy adds
  ~10 KB). Negligible.
- **Trade-off:** Accept — zero-cost fix for a build-breaker.

## Enforcement

- Auto-check **INC-006** in `.harness/check.sh` parses the Dockerfile
  AST and verifies the order of `COPY apps/api/prisma` vs
  `prisma generate`.
- Skill: `pnpm-monorepo-script-pitfalls` Pitfall 4.
- Codemod: `.harness/codemods/inc-006-dockerfile-order.py` proposes the
  reorder for any offending file.
