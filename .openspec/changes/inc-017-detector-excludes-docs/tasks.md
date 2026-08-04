# Tasks: INC-017 — Harness detector excludes documentation paths from file-axis match

Reference: `proposal.md` and `design.md` in this folder.

- [ ] 1. Add INC-017 narrative to `.harness/INCIDENTS.md`
      DoD: A new `## INC-017` section appears between the current INC-016 and the appendix, in the same format as INC-001..016. The section includes: Symptom, Root cause summary, Detection (how the false-positive was identified today), Fix (what this proposal does), and the same Prevention reference format.

- [ ] 2. Add INC-017 entry to `.harness/learnings.json`
      DoD: A new entry with `id: "INC-017"`, `category: "detector-design"`, `trigger_pattern: { files: [], symbols: [] }`, `symptom`, `root_cause_summary`, `prevention: { type: "policy", ref: "AGENTS.md §Continuous learning" }`, and `auto_check: { type: "grep_audit", command: "grep -n SOURCE_PATH_PATTERNS .harness/pattern_match.py", expected: "match" }`. The `stats.total_incidents` field at the top of the file is bumped from 16 to 17. `prevention_summary.by_policy["detector-excludes-docs"] = ["INC-017"]` is added.

- [ ] 3. Modify `.harness/pattern_match.py` to add the docs-exclude predicate
      DoD: A new module-level constant `SOURCE_PATH_PATTERNS` (list of compiled regexes per design.md Decision 2) and a helper `_is_documentation_event(ev)` is added. The file-axis loop (around pattern_match.py:96-111) gains a `continue` at the top that skips events where `_is_documentation_event(ev)` is True. The symbol-axis loop (around pattern_match.py:115-117) is **unchanged** — it still uses the combined text including docs events. No external API changes.

- [ ] 4. Create `.harness/test_pattern_match.py` with three regression cases
      DoD: A new stdlib-only `unittest` file. The three tests from design.md Decision 4 all pass when invoked via `python3 -m unittest .harness.test_pattern_match`. The test must not import any third-party package.

- [ ] 5. Wire INC-017 assertion into `.harness/check.sh`
      DoD: A new section in check.sh for INC-017 that (a) greps for `SOURCE_PATH_PATTERNS` in pattern_match.py and asserts the match exists, (b) runs `python3 -m unittest .harness.test_pattern_match` and asserts exit 0. Both assertions are wired into the same exit-code aggregation as the existing 14 checks. Running `pnpm harness:check` reports `INC-017: PASS` and the total PASS count rises from 14 to 15.

- [ ] 6. Run `pnpm harness:check` end-to-end and confirm green
      DoD: All auto-checks return PASS (or the documented SKIP count for INC-003 manual + INC-010 accepted-warning). Specifically, the total FAIL count is 0. PASS count is 15. The two existing SKIP entries remain unchanged. The new test passes.

- [ ] 7. Re-attempt Task 4 from the documentation-audit plan (ADR-005 through ADR-008)
      DoD: The four ADR files exist at `docs/decisions/ADR-005..008-*.md`, each with Status: Accepted and the four named Nygard sections. A single `docs(sdd):` commit lands them. `git log -1 --format=%s` shows the new commit. `pnpm harness:check` still returns PASS.

- [ ] 8. Re-attempt Task 5 from the documentation-audit plan (ADR-009 through ADR-011)
      DoD: ADR-009 (events-gitignored), ADR-010 (digest-freshness), and ADR-011 (no-plaintext-secrets) are written and committed in the same shape as ADR-001..008.

- [ ] 9. Archive the change folder
      DoD: Per `.openspec/AGENTS.md` §5, `specs/harness/spec.md` is moved to `.openspec/specs/harness/inc-017-detector-excludes-docs.md`, a one-line entry is added to `.openspec/CHANGELOG.md` (file created if absent), and the change folder is deleted. Final `find .openspec -type f` shows the spec is archived and the change folder is gone.
