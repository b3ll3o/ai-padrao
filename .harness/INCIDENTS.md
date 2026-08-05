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
res.setHeader("x-request-id", requestId);

// After
const reply = context.switchToHttp().getResponse() as {
  header: (n: string, v: string) => void;
};
reply.header("x-request-id", requestId);
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
import { PrismaService } from "../prisma/prisma.service"; // runtime value (DI)
import type { SomeType } from "../types"; // pure type
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
import { Logger } from "@nestjs/common";
// ...
async function bootstrap() {
  const app = await NestFactory.create(AppModule, adapter, {
    bufferLogs: true,
  });
  // ...
  await app.listen(port, "0.0.0.0");
  app.flushLogs();
  new Logger("Bootstrap").log(`listening on :${port}`);
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

---

## INC-012: No skipped tests — zero tolerance policy adopted

**Date:** 2026-08-04
**Wave:** post-stabilization (rule promotion, not a defect)
**Severity:** Policy (prevents future defects)

**Symptom (recurring):** Green test runs that don't actually exercise the code. Examples observed:

- `apps/web/package.json` carried `vitest run --passWithNoTests` for weeks: a green web test run meant "0 tests ran and 0 failed".
- INC-005 (health endpoint 401) only surfaced because a _new_ e2e was added — no existing test had ever called `/api/health` without a token, because the test file was a placeholder.
- A PR review caught a half-written `it.todo(...)` in `packages/contracts/` destined to ship "covered by tests" forever.

**Root cause:** Skipped/todo/passedWithNoTests patterns are escape hatches — they let us claim coverage while delivering zero signal. They are a form of technical debt that **prevents itself from being noticed**: the more skips accumulate, the more the green-run signal becomes a lie.

**Fix:**

1. Added `## No skipped tests` section to `AGENTS.md` listing every forbidden pattern.
2. Added auto-check **INC-012** to `.harness/check.sh` (find + grep, with `node_modules`, `.next`, `dist`, `.turbo`, `coverage`, `standalone` pruned).
3. Removed `--passWithNoTests` from `apps/web/package.json`.
4. Added `apps/web/src/lib/env.client.spec.ts` (2 tests) so removing `--passWithNoTests` doesn't immediately break the web test job.
5. Added INC-012 entry to `learnings.json` with `prevention.type: "policy"`.

**Prevention rule:** `AGENTS.md §No skipped tests` — enforced by `.harness/check.sh` INC-012.

**Would have been caught by:** Always (the auto-check runs in `pnpm prebuild`).

**Tradeoff accepted:** Removing `--passWithNoTests` requires every package to have at least one real test. New packages that aren't ready to test MUST add a placeholder test or be removed — that's the point.

**→ Promoted to AGENTS.md §No skipped tests.**

---

## INC-013: Capture scripts depend on `jq` — silent no-op forever

**Date:** 2026-08-04
**Wave:** Harness v2 (continuous learning loop)
**Severity:** Silent (capture never worked; no one noticed)

**Symptom:** The existing `~/.claude/settings.json` has a `PostToolUse` hook that runs `npx prettier --write` after every Write/Edit. The hook's bash begins with `jq -r '.tool_response.filePath // .tool_input.file_path'`. The `jq` binary is not installed on this machine. Result: the hook has been a no-op for the entire lifetime of the file. Every code change went through without auto-formatting.

**Root cause:** The hook depends on `jq`, but the install path is OS-dependent and there's no health check. The hook looks correct in code review — `jq` is a common, well-known tool — but it doesn't run on this developer's machine. There is no signal to the operator that the hook failed.

**Lesson:** every new automation in the harness MUST bash + `python3` only, and the harness itself must verify that python3 is available and that no capture script depends on `jq`. If we add a new dep, we add it to the allowlist here and nowhere else.

**Fix:**

1. Added auto-check **INC-013** to `.harness/check.sh`:
   - Asserts `python3` is available.
   - Greps every `.harness/capture.sh`, `.harness/detect.sh`, `.harness/digest.sh`, `.harness/*.py` for `jq` and fails if any match.
   - Error message: _"Fix: jq missing/broken; use python3 (see .harness/redact.py)"_ — the Alura principle of "linter messages with correction instructions."
2. Rewrote `capture.sh` to use `python3` + `flock` only.
3. Rewrote Prettier hook in `~/.claude/settings.json` to use `python3` for path extraction (PNPM-friendly).

**Prevention rule:** `AGENTS.md §Continuous learning → Capture dependencies`. The check is auto-run by `pnpm harness:check`.

**Tradeoff accepted:** A future hook that wants to use `jq` (or any other tool) must update this check, which is intentional — adding a new binary dependency is a deliberate decision that needs to be visible.

**→ Promoted to AGENTS.md §Continuous learning → Capture dependencies.**

---

## INC-014: `events/` dir is session state — must be gitignored

**Date:** 2026-08-04
**Wave:** Harness v2 (continuous learning loop)
**Severity:** Privacy / hygiene

**Symptom:** Either `.harness/events/<date>.jsonl` is committed to git (leaking session state, possibly with redacted-but-still-sensitive info), or the inline detector is disabled because the dir doesn't exist (false negative — the harness stops learning).

**Root cause:** The NDJSON event stream is _per-session_ observation data. It captures tool inputs (which may include file paths, commands, brief snippets) and tool outputs (which may include error messages referencing tokens). It is NOT source-of-truth. The source-of-truth is the aggregated `.harness/digest/<date>.md` and the proposed patches in `.harness/proposed/`. Mixing the two muddies the diff and makes the policy ("what is committed is auditable") unenforceable.

**Fix:**

1. Added `.harness/events/` to `.gitignore`.
2. Added auto-check **INC-014** to `.harness/check.sh` that asserts `.gitignore` contains the entry.
3. Kept `.harness/digest/` AND `.harness/proposed/` tracked — they are the human-reviewable artifacts.

**Prevention rule:** `AGENTS.md §Continuous learning → Events are transient`.

**Tradeoff accepted:** Without the events stream in git history, we can't replay past sessions. This is intentional — the digest captures the conclusions, and the raw events were always volatile observation data.

**→ Promoted to AGENTS.md §Continuous learning → Events are transient.**

---

## INC-015: Daily digest failed silently — harness stopped learning

**Date:** 2026-08-04
**Wave:** Harness v2 (continuous learning loop)
**Severity:** Operational (silent learning stall)

**Symptom:** Capture kept running (events kept accumulating), but the digest was never written. After 7+ days, the harness had thousands of events but `learnings.json` was stale. The operator had no idea.

**Root cause:** Cron-triggered agents fail silently: the scheduler dies, the worker crashes, the daily prompt hits an error, the user pauses the session. Without a freshness check, nothing alerts the operator.

**Fix:**

1. Added auto-check **INC-015** to `.harness/check.sh` that asserts at least one `.harness/digest/*.md` file has `mtime < 25h`.
2. Error message: _"Fix: run `pnpm harness:digest` to refresh the daily digest."_ (Alura principle again.)
3. Made the daily digest also run on demand via `pnpm harness:digest`, not only via cron.

**Prevention rule:** `AGENTS.md §Continuous learning → Daily digest freshness`.

**Tradeoff accepted:** A bucket-of-25h means the operator can skip one day without triggering the failure. That's intentional — the harness shouldn't be noisy when the operator is on vacation.

**→ Promoted to AGENTS.md §Continuous learning → Daily digest freshness.**

---

## INC-016: Token-shaped string leaked into source — irreversible in git history

**Date:** 2026-08-04
**Wave:** Harness v2 (continuous learning loop)
**Severity:** High (secret rotation + history rewrite)

**Symptom:** A live token (Anthropic, GitHub, OpenAI, AWS) appears in source code. The file is committed. The secret is now permanently in the git history. The next commit can remove it, but the original SHA is recoverable.

**Root cause:** Tokens travel through editor copy-paste, AI assistant context, and env var dumps. The `~/.claude/settings.json` file on this machine carries a live `ANTHROPIC_AUTH_TOKEN` (`sk-cp-…`) and `GITHUB_PERSONAL_ACCESS_TOKEN` (`github_pat_…`) in plaintext. Any hook that captures tool inputs without redaction risks writing these tokens to disk.

**Two-layer defense:**

1. **Redaction at capture (sensor).** `.harness/redact.py` strips tokens before they hit `.harness/events/`. This is the **seatbelt** — it stops the leak from being persisted.
2. **Secret-shape scan at pre-commit (airbag).** **INC-016** in `.harness/check.sh` greps every `*.ts`/`*.tsx`/`*.js`/`*.jsx` under `apps/` and `packages/` for known token shapes (`sk-ant-`, `sk-cp-`, `ghp_`, `github_pat_`, `AKIA…`) and fails the build. This is the **airbag** — it catches the leak even if the seatbelt was forgotten.

**Fix:**

1. Added `.harness/redact.py` (hook on every Bash/Edit/Write/MCP).
2. Added auto-check **INC-016** to `.harness/check.sh`.
3. Error message: _"Fix: rotate the token and move to a secret store; do not commit plaintext credentials."_

**Prevention rule:** `AGENTS.md §Continuous learning → No plaintext secrets`.

**Tradeoff accepted:** The check uses regex patterns, NOT a real secret scanner (gitleaks, trufflehog). It catches the most common shapes but a determined attacker can bypass it with slight obfuscation. That's acceptable — the goal is "no accidents," not "no adversarial bypasses." For the adversarial case, we'd add gitleaks as a future CI step.

**→ Promoted to AGENTS.md §Continuous learning → No plaintext secrets.**

---

## INC-017: L2 detector fires on prose that documents its own trigger patterns

**Date:** 2026-08-04
**Wave:** Documentation audit (project-documentation-audit)
**Severity:** Medium (workstream-blocking false positive)

**Symptom:** During the 2026-08-04 documentation audit (ADR generation under `docs/decisions/`), every Write of an ADR body that explained the INC-002 or INC-003 rules triggered the L2 detector with a confirmation prompt. The agent's commits stalled. No runtime source code was touched — only markdown prose that quotes the trigger patterns in order to document them.

**Root cause:** `.harness/pattern_match.py`'s file-axis check uses substring matching against the `trigger_pattern.files` values declared in `.harness/learnings.json`. For INC-002 and INC-003, those values are the runtime source-path glob that names where the bug used to live. The detector flattens every event's `tool_input` (full JSON) into one searchable blob. A `Write` event for a markdown file under `docs/decisions/` carries that markdown body in `tool_input.content`; if the body quotes the trigger pattern (which is the entire purpose of an ADR), the detector counts the Write event as a file-axis hit even though no code under `apps/` or `packages/` was touched.

**Detection:** Replayed the last 20 events from `.harness/events/<date>.jsonl` through the matcher with the algorithm in `pattern_match.py` reproduced step-by-step. The combined text contained multiple occurrences of the INC-002 source-path substring (from prior ADR-001..004 Write events still in the JSONL stream) and one occurrence of the INC-002 symbol (from a diagnostic `grep` Bash command). Both axes passed; INC-002 emitted. The matched events were: ADR Write events that committed only to `docs/decisions/`, plus one diagnostic bash. None of those touched runtime source.

**Fix:** Introduced a documentation-path filter (a constant `SOURCE_PATH_PATTERNS` and a diagnostic-bash allowlist, both at the top of `.harness/pattern_match.py`). Events whose `file_path` matches `^docs/`, `.harness/INCIDENTS.md`, or `.harness/learnings.json`, or whose `command` matches a read-only diagnostic regex, are skipped from the file-axis count only. The symbol-axis is unchanged — code violations still surface as before. Added `.harness/test_pattern_match.py` with three regression cases (docs-only window, code-only window, mixed window). Wired into `.harness/check.sh` as the INC-017 auto-check.

**Two-layer defense:**

1. **Path filter at detect time (sensor).** `.harness/pattern_match.py` excludes the documentation paths before counting file-axis hits. This is the **seatbelt** — it stops the false positive at the source.
2. **Auto-check at pre-commit (airbag).** **INC-017** in `.harness/check.sh` greps for the `SOURCE_PATH_PATTERNS` constant and runs the regression test. If a future cleanup wave removes the filter, both layers fail and the build blocks.

**Prevention rule:** `AGENTS.md §Continuous learning → Capture dependencies` (extended to include detection dependencies) and `docs/superpowers/specs/2026-08-04-project-documentation-audit-design.md §Out of scope`.

**→ Promoted to AGENTS.md §Continuous learning → Capture dependencies (extended).**

---

## INC-018: L2 detector false-positives on Read events, TodoWrite, worktree paths, and python heredocs

**Date:** 2026-08-05
**Wave:** Post-merge validation prep (run-tests + post-merge hook)
**Severity:** Workstream-blocking (every session edit triggered the prompt)

**Symptom:** After the project-documentation-audit wave committed ADRs under `docs/decisions/`, every subsequent action — including pure Read operations and TodoWrite updates — caused the L2 detector to emit `INC-004` and demand confirmation. The workstream was effectively blocked. No runtime source mutating `apps/api/package.json` was being touched.

**Root cause:** The INC-017 fix added a docs-path filter and a diagnostic-bash regex, but several new false-positive sources were still inflating the file-axis count. The full list, with detection path:

1. **Worktree sessions.** `.claude/worktrees/<name>/` carries its own cwd and branch but the same event stream. When a worktree Write or Edit touches `apps/api/package.json`, the file_path still substring-matches `apps/api/package.json` in `learnings.json` — the main repo's detector emits, even though the worktree branch is isolated.
2. **Read events.** INC-004's trigger pattern is a mutation-only pattern (`prisma.seed` block missing), but a `Read` event on `apps/api/package.json` was counting as a file-axis hit. Reading is inspection, not mutation.
3. **TodoWrite events.** The L1 hook captures every TodoWrite call. The `content` field carries prose like "Investigate INC-004" — that prose substring-matches the INC-004 file-axis declaration. TodoWrite is session planning, not source mutation.
4. **Python heredocs.** The INC-017 diagnostic-bash regex matched `python3 -c ...` but not `python3 << 'PY' ... PY`. The previous-session bash invocations that ran `python3 - <<EOF` heredocs to test the matcher itself were flattening the trigger symbols into the window and triggering INC-004.
5. **Wrong command lookup.** The INC-017 diagnostic-bash path read `event["command"]`, but post-INC-017 capture records the actual command under `event.tool_input.command` (matching the standard Claude Code PostToolUse shape). The top-level `command` field was empty for Bash events, so the regex never matched.
6. **Wrong file_path lookup.** Same shape mismatch as (5): Edit/Write events store the actual `file_path` under `tool_input.file_path`, not at the top level. The INC-017 docs-path filter used top-level `event["file_path"]`, so Edit/Write events on `docs/decisions/*.md` slipped through.
7. **Absolute paths.** The capture hook records paths as absolute (`/home/leo/.../docs/decisions/ADR-018.md`) on this machine, not relative (`docs/decisions/ADR-018.md`). The INC-017 regex anchored on `^docs/` and `^\.harness/`, both of which fail to match absolute paths.
8. **`/tmp/` test scratch.** Test drivers that exercise the hook or the detector live in `/tmp/` and intentionally contain trigger paths as fixtures. Those Write events are not runtime-source mutations.

**Detection:** Ran `pattern_match.main()` against the real events JSONL after each candidate fix. The first run produced INC-004 hits even with the docs-path filter already in place. Walked the matched events back to source: 2 worktree Write events, 4 Read events, 2 TodoWrite events, 1 diagnostic heredoc, then on the next iteration 11 Edit events on harness-internal files with absolute paths, then on a further iteration 2 Write events on `/tmp/test-driver.sh` containing fixture paths. Confirmed root cause by reading the events verbatim and printing `file_path` vs `tool_input.file_path` for each.

**Fix:** Eight layered filters in `.harness/pattern_match.py`:

1. Skip `tool_name == "Read"` events from the file-axis count (symbol-axis still sees them).
2. Skip events whose `file_path` matches `\.claude/worktrees/` (new SOURCE_PATH_PATTERNS entry).
3. Skip `tool_name == "TodoWrite"` events entirely from the file-axis gate.
4. Extend `_DIAGNOSTIC_BASH_RE` to `python3\s+(?:-c\b|<<)`.
5. Read Bash command from `event.tool_input.command` (fall back to top-level `event["command"]` for older captures).
6. Read `file_path` from `event.tool_input.file_path` as a fallback when the top-level field is empty.
7. Anchor `SOURCE_PATH_PATTERNS` with `(?:^|/)(?:docs/|\.harness/)` so absolute paths also match.
8. Skip events whose `file_path` matches `(?:^|/)/tmp/` (ephemeral test scratch).

**Two-layer defense:**

1. **Filters at detect time (sensor).** `.harness/pattern_match.py` excludes Read, TodoWrite, worktree, absolute-path, `/tmp/`, and heredoc events before counting file-axis hits. This is the **seatbelt** — stops the false positive at the source.
2. **Auto-check at pre-commit (airbag).** **INC-018** in `.harness/check.sh` asserts all seven filters are present in `pattern_match.py` (`Read` skip, `TodoWrite` skip, `\.claude/worktrees/` regex, `python3\s+(?:-c\b|<<)` regex, `tool_input.command` lookup, absolute-path regex, `/tmp/` regex). The INC-017 test still runs the regression suite. If a future cleanup wave removes a filter, both layers fail and the build blocks.

**Prevention rule:** `AGENTS.md §Continuous learning → Capture dependencies` (extended to list the detector's exclusion list). New exclude-classes require updating the auto-check in the same patch.

**Tradeoff accepted:** Worktree sessions now bypass INC-004 entirely. That is intentional — worktree branches are isolated for the duration of the worktree; once the branch is merged, the contributing commits are re-evaluated through the main repo's detector and INC-017 (already passing) will surface the real trigger patterns. Files under `/tmp/` also bypass the gate for the same reason — they are ephemeral scratch by definition.

**Verification:**

- `pattern_match.main()` against the real `events/2026-08-05.jsonl` returns `rc=0` with no INC id.
- Pre-fix synthetic test (3 Edit events to `apps/api/package.json`) still emits INC-004 — the fix does not weaken code-side detection.
- All 11 regression tests in `.harness/test_pattern_match.py` pass (3 INC-017 + 8 INC-018).
- `.harness/check.sh` reports 16 PASS / 0 FAIL / 3 SKIP.
- The 9-scenario post-merge hook test driver (`/tmp/test-postmerge.sh`) passes: lockfile-only, harness-only, src-only, prisma-only, lockfile+src, docs-only, harness+src, all-four, unrelated.

**→ Promoted to AGENTS.md §Continuous learning → Capture dependencies (expanded exclusion list).**

---

## Pattern: Alura's "guias + sensores" applied to the harness

After 16 incidents, the harness has both halves of the loop Alura describes:

- **Guias (feedforward):** codemods in `.harness/codemods/` (INC-002, INC-003, INC-006, INC-009) — pre-emptive transformations that rewrite known anti-patterns to their safe form _before_ the agent commits the bad pattern.
- **Sensores (feedback):** capture (L1), inline detection (L2), daily digest (L3), auto-checks (L4) — observations that surface when known patterns re-appear.

**Codemods are documented in `.harness/codemods/README.md`.** Each codemod has a `--check` (dry-run) and `--apply` mode, scopes tightly to the files the INC pattern actually targets, and is stdlib-only. The next time we add an INC-XXX, we should also add a codemod for it as part of the prevention layer (when the pattern is regular enough to rewrite deterministically).

**The Alura takeaway applied here:** "sempre que o agente cometer o mesmo tipo de erro mais de uma vez, registre a falha, identifique o padrão, e crie uma forma automática de prevenção." We've codified this — every codemod here exists because the same pattern escaped review at least once.

---

## Skills referenced

- [monorepo-dod-validation](~/.claude/skills/monorepo-dod-validation/SKILL.md)
- [fix-wave-orchestration](~/.claude/skills/fix-wave-orchestration/SKILL.md)
- [nestjs-fastify-gotchas](~/.claude/skills/nestjs-fastify-gotchas/SKILL.md)
- [pnpm-monorepo-script-pitfalls](~/.claude/skills/pnpm-monorepo-script-pitfalls/SKILL.md)

## Codemods referenced

- [`.harness/codemods/inc-002-fastify-response.py`](codemods/inc-002-fastify-response.py) — INC-002 anti-pattern auto-fix
- [`.harness/codemods/inc-003-nest-di-imports.py`](codemods/inc-003-nest-di-imports.py) — INC-003 anti-pattern auto-fix
- [`.harness/codemods/inc-006-dockerfile-order.py`](codemods/inc-006-dockerfile-order.py) — INC-006 anti-pattern auto-fix
- [`.harness/codemods/inc-009-nest-logger.py`](codemods/inc-009-nest-logger.py) — INC-009 anti-pattern auto-fix
