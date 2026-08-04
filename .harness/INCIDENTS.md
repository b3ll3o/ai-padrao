# Harness Incident Log

> This file is the project's **learning memory**. Every real defect that escaped review, every bug that took more than one attempt to fix, and every subtle integration issue gets logged here with enough context to prevent reincarnation.

**Format:** One section per incident, dated, with: symptom → root cause → fix → prevention rule.

**How to use:**
- Before any new feature: skim recent incidents for patterns that apply.
- After any non-trivial bug fix: add an entry here.
- Periodically: convert recurring incidents into AGENTS.md rules, lint rules, or skills.

---

## INC-001: `@fastify/static` missing — SwaggerModule setup crashes API

**Date:** 2026-08-04
**Wave:** D
**Severity:** Blocker (api container exits immediately, port 3001 unreachable)

**Symptom:**
```
ERROR [PackageLoader] The "@fastify/static" package is missing.
Please, make sure to install it to take advantage of FastifyAdapter.useStaticAssets().
```

**Root cause:** `@nestjs/swagger`'s `SwaggerModule.setup('docs', ...)` implicitly calls `FastifyAdapter.useStaticAssets()` to serve Swagger UI's static files. The Nest framework does NOT declare `@fastify/static` as a dependency — every consumer must install it themselves. Adding it post-hoc is non-obvious because the error message mentions a method that nobody called explicitly.

**Version trap:** `@fastify/static` version must match the installed `fastify` major:
- fastify 4.x → `@fastify/static@^7`
- fastify 5.x → `@fastify/static@^8` (Nest 11 default)

Using `^7` against fastify 5 throws `FST_ERR_PLUGIN_VERSION_MISMATCH` at boot.

**Fix:**
```bash
pnpm --filter @ai-padrao/api add @fastify/static@^8
```
Plus matching version in Dockerfile install step.

**Prevention rule (skill):** [[nestjs-fastify-gotchas]] Gotcha 3.

**Would have been caught by:** A pre-flight check that grep'd `SwaggerModule.setup` in any Fastify-based Nest project and verified `@fastify/static` was installed.

---

## INC-002: `LoggingInterceptor.res.setHeader is not a function` — 500 on every request

**Date:** 2026-08-04
**Wave:** E2
**Severity:** Blocker (every endpoint 500s once requests actually start flowing)

**Symptom:** `curl http://localhost:3001/api/health` returns 500 with stack trace pointing at `LoggingInterceptor.intercept` calling `res.setHeader`. Affects every endpoint uniformly.

**Root cause:** `context.switchToHttp().getResponse()` returns a Fastify `FastifyReply` object under `FastifyAdapter`, NOT a Node `http.ServerResponse`. Fastify exposes `.header(name, value)` instead of `.setHeader(name, value)`. The interceptor was written assuming the Express default and worked during unit tests (which mock the response) but exploded in real traffic.

**Discovery path:** Surfaced by INC-005 (health controller fix) — once the request reached the interceptor pipeline, the next layer down failed. Could have been caught earlier by an integration test that boots the real Fastify adapter, not a mock.

**Fix:**
```ts
// Before
res.setHeader('x-request-id', requestId);

// After
const reply = context.switchToHttp().getResponse() as { header: (n: string, v: string) => void };
reply.header('x-request-id', requestId);
```

**Prevention rule (skill):** [[nestjs-fastify-gotchas]] Gotcha 2.

**Would have been caught by:** A grep audit for `setHeader\|\.json(\|\.send(` in any Nest + Fastify codebase. Add to checklist.

---

## INC-003: `import type` erases NestJS decorator metadata — silent DI failure

**Date:** 2026-08-04
**Wave:** B4
**Severity:** Blocker (10 tests passing → 10 tests failing after `eslint --fix`)

**Symptom:** After running `eslint --fix` to auto-fix `@typescript-eslint/consistent-type-imports`, every NestJS service test failed with:
```
Nest can't resolve dependencies of the AuthService (?). Please make sure that the argument at index [0] is available in the Auth context.
```

**Root cause:** Nest relies on `emitDecoratorMetadata: true` to emit `design:paramtypes` for constructor parameters. This metadata references the IMPORTED VALUE at runtime. `import type { PrismaService }` erases the import from the emitted JS — TypeScript substitutes `Object` for the type slot, and Nest's DI container cannot resolve the provider.

**The trap:** The lint rule is correct in spirit (most of the time `import type` is what you want). But for NestJS DI it's actively harmful, and the auto-fix doesn't know about the framework boundary.

**Fix:** Split imports by usage:
```ts
import { PrismaService } from '../prisma/prisma.service';   // runtime value (DI)
import type { SomeType } from '../types';                   // pure type
```
Plus `eslint-disable-next-line @typescript-eslint/consistent-type-imports` on lines that import DI'd services.

**Prevention rule (skill):** [[nestjs-fastify-gotchas]] Gotcha 1.

**Would have been caught by:** A Nest-specific eslint rule override that exempts files under `**/controllers/**`, `**/services/**`, `**/guards/**`, `**/strategies/**`. Or by a CI step that runs `pnpm test` after `pnpm lint --fix` to catch the regression before merge.

---

## INC-004: `prisma db seed` silently no-ops without registration

**Date:** 2026-08-04
**Wave:** A3
**Severity:** Silent failure (exit 0, no DB writes, no log)

**Symptom:** Running `pnpm db:seed` returns immediately with no output. DB has no seed user. No error, no warning.

**Root cause:** `apps/api/prisma/schema.prisma` lacked a `prisma.seed` block, AND `apps/api/package.json` lacked the `"prisma": { "seed": "..." }` config. Prisma's `db seed` command silently no-ops if neither is present — there's no warning that the command did nothing.

**Discovery path:** Surfaced during DoD Step 3 (seed verification). The migration step succeeded, but the seed user wasn't in the DB. Manual verification of the seed script (running it directly via `ts-node`) showed it worked — pointing the finger at Prisma's seed runner.

**Fix:** Add to `apps/api/package.json`:
```json
"prisma": {
  "seed": "ts-node prisma/seed.ts"
}
```

**Prevention rule (skill):** [[pnpm-monorepo-script-pitfalls]] Pitfall 2.

**Would have been caught by:** A pre-deploy verification step that checks for either the `prisma.seed` block in `schema.prisma` OR the `prisma.seed` block in the api package.json. Add as a `pnpm prebuild` check.

---

## INC-005: Global JwtAuthGuard blocks `/api/health` — 401 on liveness probes

**Date:** 2026-08-04
**Wave:** E1
**Severity:** Operational (Kubernetes/Docker healthchecks would mark the pod unhealthy)

**Symptom:** `curl http://localhost:3001/api/health` returns 401 Unauthorized. Health probes (k8s liveness, Docker `HEALTHCHECK`, monitoring) carry no JWT — they expect 200.

**Root cause:** `JwtAuthGuard` was registered globally as `APP_GUARD`. Every endpoint requires JWT unless explicitly opted out via `@Public()`. The health controller did not opt out. This is a NestJS convention that's easy to miss when scaffolding.

**Fix:** Add `@Public()` to the health controller (class-level):
```ts
@Public()
@ApiTags('health')
@Controller('health')
export class HealthController { ... }
```

Also apply `@Public()` to `auth/login`, `auth/register`, `auth/refresh` — otherwise users can't log in.

**Prevention rule (skill):** [[nestjs-fastify-gotchas]] Gotcha 4.

**Would have been caught by:** An e2e test that hits `/api/health` without a token. Add to the e2e suite as a guard against regression.

---

## INC-006: Dockerfile `prisma generate` runs BEFORE `COPY apps/api`

**Date:** 2026-08-04
**Wave:** A2 + D
**Severity:** Build breaker (image cannot be rebuilt)

**Symptom:** `docker compose build api` fails at:
```
RUN pnpm --filter @ai-padrao/api exec prisma generate
Error: Could not find Prisma Schema that is required for this command.
schema.prisma: file not found
```

**Root cause:** The Dockerfile ran `prisma generate` on line 12 but `COPY apps/api ./apps/api` (which brings the schema) on line 13. The currently-running image was built before the fix landed, so the container started — but a fresh rebuild fails.

**Fix:** Move the COPY above the generate:
```dockerfile
COPY apps/api/prisma ./apps/api/prisma    # schema first
RUN pnpm --filter @my-app/api exec prisma generate
COPY apps/api ./apps/api                  # rest of the app
```

**Prevention rule (skill):** [[pnpm-monorepo-script-pitfalls]] Pitfall 4.

**Would have been caught by:** A CI step that does a clean `docker compose build --no-cache api` before deploying. Many CI setups cache layers and miss this until production.

---

## INC-007: ESLint `--config @scope/pkg/x.js` shorthand doesn't resolve

**Date:** 2026-08-04
**Wave:** B1 + B3
**Severity:** Lint step fails in every consumer

**Symptom:** `pnpm --filter @my-app/api lint` fails:
```
ENOENT: no such file or directory, stat '/…/apps/api/@scope/config-eslint/nest.js'
```

**Root cause:** ESLint's `--config` flag is a filesystem path, not a Node module specifier. The shorthand `@scope/pkg/file` worked in eslint 8 (which resolved through `require.resolve` internally), but eslint 9 flat-config dropped that resolution — it stats the literal string.

**Fix:** Use `node -p "require.resolve(...)"` to pre-resolve:
```json
"lint": "eslint src --config $(node -p \"require.resolve('@scope/config-eslint/nest.js')\")"
```

**Prevention rule (skill):** [[pnpm-monorepo-script-pitfalls]] Pitfall 3.

**Would have been caught by:** Running `pnpm install` in CI after adding the shared eslint config — the install would succeed but lint would fail in every consumer.

---

## INC-008: MailHog port collision with sibling project

**Date:** 2026-08-04
**Wave:** C
**Severity:** Stack-up blocker

**Symptom:** `docker compose up -d` fails:
```
Bind for 127.0.0.1:1025 failed: port is already allocated
```

**Root cause:** Sibling project `pedi_ai_mailpit` is holding host ports 1025 (smtp) and 8025 (ui). The error doesn't tell you which process owns the port.

**Fix:** Remap host-side bindings in `docker-compose.yml` (container ports unchanged so internal DNS still works):
```yaml
services:
  mailhog:
    ports:
      - "11125:1025"
      - "18025:8025"
```

**Prevention rule (skill):** [[pnpm-monorepo-script-pitfalls]] Pitfall 5.

**Would have been caught by:** Documenting "use non-default ports" in the project README's quickstart. Default ports are well-known and likely to collide.

---

## INC-009: `console.log` in main.ts + ESLint `no-console` + `console.warn` writes to stderr

**Date:** 2026-08-04
**Wave:** F1
**Severity:** Cosmetic lint warning + observability fragmentation

**Symptom:** `pnpm lint` reports `no-console` warning on `console.log(\`api listening on ...\`)`. Initial "fix" of swapping to `console.warn` silenced the warning but moved the message from stdout to stderr, breaking any tooling that grepped stdout for the startup banner.

**Root cause:** Two separate issues collapsed into one symptom:
1. ESLint `no-console` rule defaults to disallowing all `console.*` except `warn`/`error`.
2. `console.warn` writes to stderr; `console.log` writes to stdout.

**Proper fix:** Use Nest's structured `Logger` so the startup banner goes through the same logger as the rest of the app (better for OTel, log shippers, JSON formatting):
```ts
import { Logger } from '@nestjs/common';
// ...
async function bootstrap() {
  const app = await NestFactory.create(AppModule, adapter, { bufferLogs: true });
  // ...
  await app.listen(port, '0.0.0.0');
  app.flushLogs();
  new Logger('Bootstrap').log(`listening on :${port}`);
}
```

**Prevention rule (skill):** [[nestjs-fastify-gotchas]] Gotcha 5 + 6.

**Would have been caught by:** A Nest-specific eslint config that whitelists `console` for `**/*.spec.ts` and `**/main.ts` only. Or by a custom `no-bare-console` rule that allows `Logger.log` but disallows `console.*`.

---

## INC-010: `NestJS 11 + @nestjs/swagger@8` peer warning

**Date:** 2026-08-04
**Wave:** D (after adding @fastify/static@8)
**Severity:** Cosmetic (warning only)

**Symptom:** `pnpm install` warns:
```
@nestjs/swagger@8.1.1 peer-depends on @fastify/static@"^6.0.0 || ^7.0.0"
```

**Root cause:** `@nestjs/swagger@8` doesn't yet officially support NestJS 11. We're using `@nestjs/swagger@8.1.1` with NestJS 11.1.28 (because there's no `@nestjs/swagger@9` yet). The warning is informational — the app works fine.

**Fix:** None taken (acceptable for a scaffold). Track upstream for `@nestjs/swagger@9` release.

**Prevention rule:** Document in AGENTS.md that NestJS 11 + Swagger 8 is the current best-effort pairing until Swagger 9 ships.

---

## INC-011: Vite CJS Node API deprecation warning in vitest

**Date:** 2026-08-04
**Wave:** F2
**Severity:** Cosmetic (warning only)

**Symptom:** Every `pnpm --filter @ai-padrao/web test` prints:
```
The CJS build of Vite's Node API is deprecated.
```

**Root cause:** Vite detects that `apps/web/package.json` doesn't declare `"type": "module"`, so it falls back to its CJS Node API at vitest boot. That API is deprecated.

**Fix:** Add `VITE_CJS_IGNORE_WARNING=true` to the test script. Zero runtime impact; recommended by Vite's own troubleshooting docs.

**Prevention rule:** Document Vite CJS behavior in `apps/web/README.md` for future maintainers.

---

## Pattern: All incidents share 3 traits

1. **Typecheck passed.** None of these defects were caught by TypeScript.
2. **Unit tests passed (or didn't cover the path).** None were caught by unit tests alone.
3. **Only surfaced via DoD validation** — the 12-step sequence is the safety net.

This validates the architectural decision to make DoD validation mandatory before declaring any release done. The unit tests + typecheck alone would have shipped a broken API.

## Suggested AGENTS.md additions (cumulative learning)

After these 11 incidents, the following rules should be considered for `AGENTS.md`:

- [ ] Add a `## Common pitfalls` section that links to each skill with a one-liner of when to invoke it.
- [ ] Add a "When adding new infrastructure" checklist: did you run `pnpm db:seed` and verify the user exists?
- [ ] Add a "When changing Docker config" checklist: did you test `docker compose build --no-cache` from a clean state?
- [ ] Add a "When writing interceptors/middleware in Nest + Fastify" checklist: did you use `.header()` not `.setHeader()`?
- [ ] Add a "When refactoring imports" checklist: did you run unit tests after `eslint --fix`?

## Skills referenced

- [monorepo-dod-validation](~/.claude/skills/monorepo-dod-validation/SKILL.md)
- [fix-wave-orchestration](~/.claude/skills/fix-wave-orchestration/SKILL.md)
- [nestjs-fastify-gotchas](~/.claude/skills/nestjs-fastify-gotchas/SKILL.md)
- [pnpm-monorepo-script-pitfalls](~/.claude/skills/pnpm-monorepo-script-pitfalls/SKILL.md)
