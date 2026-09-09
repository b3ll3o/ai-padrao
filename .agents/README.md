# `.agents/` — AI tooling and rulebook

This folder is the **canonical home** for everything that exists to instruct,
guide, or extend AI coding assistants (Claude Code, Gemini CLI, Codex, Aider,
Copilot, Cursor, etc.) working in this repository. Keeping AI configuration in
one tree makes it easy to audit, version, and audit-diff when conventions
change.

## Layout

| Path | Purpose | Read by |
| --- | --- | --- |
| [`AGENTS.md`](AGENTS.md) | Universal rulebook — SDD mandate, no-skipped-tests, no-plaintext-secrets, forbidden actions, common commands. | All agents (root `AGENTS.md` is a symlink). |
| [`CLAUDE.md`](CLAUDE.md) | Claude-Code-specific orientation — project identity, architecture, ADRs, editor/AI config, workflow expectations. | Claude Code (root `CLAUDE.md` is a symlink). |
| [`skills/`](skills/) | Skills — invocable expertise for specific tasks. Each skill is a folder with a `SKILL.md` (frontmatter + body) and optional `templates/`, `scripts/`, `references/`, `assets/` subfolders. Conforms to the [Agent Skills specification](https://agentskills.io/specification). | Claude Code discovers via `.claude/skills` (symlink). Other agents may load on demand. |
| [`sdd/AGENTS.md`](sdd/AGENTS.md) | SDD workflow rules — proposal/tasks/design/spec templates, archive procedure, change lifecycle. | OpenSpec-aware agents; `.openspec/AGENTS.md` is a symlink for backward compatibility. |

## Why this layout

- **Symlinks at the discovery points.** Root `AGENTS.md` and `CLAUDE.md`, plus
  `.claude/skills` and `.openspec/AGENTS.md`, are symlinks into `.agents/`.
  Tools that look in the conventional locations (`AGENTS.md` at root, skills
  under `.claude/skills/`) still find them. Editing any of those resolves to
  the file in `.agents/`.
- **One tree, one diff.** When you add or change a policy, the diff is in
  `.agents/`. The symlinks make the change visible at every conventional path
  without duplicating content.
- **No vendor lock-in.** Nothing here is Claude-Code-specific except the
  `skills/` folder format and the CLAUDE.md orientation file. Other agents
  read AGENTS.md, point at the same ADRs, and load skills on demand if they
  support the Agent Skills spec.

## Adding to this folder

- **New skill** → create `.agents/skills/<skill-name>/SKILL.md` with the
  required `name` + `description` frontmatter, then reference any templates or
  scripts via relative paths from the skill root. The symlink
  `.claude/skills/<skill-name>` will resolve automatically.
- **New top-level guidance** → edit `.agents/AGENTS.md` (universal) or
  `.agents/CLAUDE.md` (Claude-Code-specific). Avoid duplicating content into
  the symlinks.
- **Move a file** → keep the canonical copy in `.agents/` and update the
  symlink target if the discovery path needs to move.

## What is intentionally NOT here

- Runtime state (`.claude/worktrees/`, `.claude/scheduled_tasks.json`) — these
  are gitignored; they belong to the agent runtime, not to the policy.
- The `.harness/` self-improving loop (removed 2026-09-09) — replaced by
  manual review + CI gating.
- The OpenSpec spec archive (`.openspec/specs/`), changelog
  (`.openspec/CHANGELOG.md`), templates (`.openspec/templates/`), and change
  proposals (`.openspec/changes/`) — these are project artifacts, not AI
  configuration.
