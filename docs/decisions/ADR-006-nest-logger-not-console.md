# ADR-006 — Use Nest `Logger`, not `console.*` in `main.ts`

- **Status:** Accepted
- **Date:** 2026-08-04

## Context

NestJS ships `Logger` (and the contextual `Logger` passed to services via
`new Logger(Service.name)`). It writes through Pino (when configured) and
respects log levels, JSON mode, and redaction. `console.log` in
`apps/api/src/main.ts` bypasses all of that — log level is hard-coded
"always print", the structured-log shape is lost, and redaction doesn't
run. Worse, in production a stray `console.log("user:", user)` becomes
a PII leak.

## Decision

`apps/api/src/main.ts` MUST use the Nest `Logger` for every startup-time
log line. Service-level files (controllers, guards, interceptors) MUST
`new Logger(Name)` at the top of the class and use `this.logger`. Raw
`console.log|warn|error|info|debug` is forbidden in `main.ts` and
discouraged everywhere else (test setup files excepted).

```ts
import { Logger } from "@nestjs/common";

async function bootstrap() {
 const app = await NestFactory.create(AppModule, { bufferLogs: true });
 app.useLogger(app.get(Logger)); // pino bridge in prod
 await app.listen(3000);
 Logger.log("API listening on :3000", "Bootstrap");
}
```

## Consequences

- **Easier:** Structured logs flow to the same sink as request logs;
 redaction works; log-level filters apply.
- **Harder:** `console.log` for debug-printing is no longer free —
 developers reach for `Logger.debug` and forget to enable debug level.
- **Trade-off:** Accept — PII risk and log-quality regressions are
 worth the friction.

## Enforcement

- Skill: `nestjs-fastify-gotchas` Gotcha 3.
