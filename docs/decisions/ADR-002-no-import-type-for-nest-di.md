# ADR-002 — Don't `import type` NestJS DI'd services

- **Status:** Accepted
- **Date:** 2026-08-04
- **Incident reference:** INC-003 (full context in `.harness/INCIDENTS.md`)

## Context

NestJS relies on `emitDecoratorMetadata: true` to emit `design:paramtypes`
references for constructor parameters. The emitted JavaScript references
the import _value_ at runtime. TypeScript's `import type { Foo }` syntax
erases the value from the emitted JS, substituting `Object` for the type
slot. The NestJS DI container then cannot resolve the provider, surfacing
a cryptic "Nest can't resolve dependencies of the XService (?)" error
on first boot.

`@typescript-eslint/consistent-type-imports` is correct for most code —
but the auto-fix doesn't know about the framework boundary, and silently
breaks every DI'd service in the codebase on `pnpm lint --fix`.

## Decision

In any file under `apps/api/src/modules/**` that exports a NestJS class
(controller, service, guard, interceptor, strategy, decorator), DI'd
service imports MUST be runtime values:

```ts
import { PrismaService } from "../prisma/prisma.service"; // runtime value
import type { SomeType } from "../types"; // pure type only
```

The eslint rule is correct in spirit but wrong here. Suppress it on
relevant lines with `// eslint-disable-next-line @typescript-eslint/consistent-type-imports`.

## Consequences

- **Easier:** DI continues to work; `pnpm lint --fix` is safe.
- **Harder:** Splitting imports by usage is a small cost.
- **Trade-off:** Accept — the alternative (a global eslint exemption) would
  defeat the lint rule for everyone.

## Enforcement

- Skill: `nestjs-fastify-gotchas` Gotcha 1.
- Codemod: `.harness/codemods/inc-003-nest-di-imports.py` audits DI'd
  files and surfaces offending imports.
- Auto-check **INC-003** is documented but **manual** (it would require a
  TypeScript-aware rule that knows framework boundaries); review by hand.
