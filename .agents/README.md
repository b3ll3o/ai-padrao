# `.agents/` — AI tooling and rulebook (canonical)

This folder is the **canonical home** for everything that exists to instruct,
guide, or extend AI coding assistants (Claude Code, Gemini CLI, Codex, Aider,
Copilot, Cursor, etc.) working in this repository. The project follows the
[AGENTS.md convention](https://agents.md/) and the
[Agent Skills specification](https://agentskills.io/specification); both are
realised in this single tree. There is no `.claude/`, `CLAUDE.md`, or other
agent-specific root-level file — everything lives here.

## Layout

| Path | Purpose | Read by |
| --- | --- | --- |
| [`AGENTS.md`](AGENTS.md) | Universal rulebook — SDD mandate, no-skipped-tests, no-plaintext-secrets, forbidden actions, common commands. | All agents. Root `AGENTS.md` is a symlink for tools that look there. |
| [`CLAUDE.md`](CLAUDE.md) | Claude-Code-specific orientation — project identity, architecture, ADRs, editor/AI config, workflow expectations. | Claude Code (and any agent that wants Claude-Code-specific tips). |
| [`skills/`](skills/) | Skills — invocable expertise for specific tasks. Each skill is a folder with a `SKILL.md` (frontmatter + body) and optional `templates/`, `scripts/`, `references/`, `assets/` subfolders. | Claude Code discovers via `.agents/skills/` by default in this repo (see "Tool discovery" below). |
| [`sdd/AGENTS.md`](sdd/AGENTS.md) | SDD workflow rules — proposal/tasks/design/spec templates, archive procedure, change lifecycle. | OpenSpec-aware agents; `.openspec/AGENTS.md` is a symlink for tools that still expect it there. |

## Why this layout

- **One tree, one diff.** When you add or change a policy, the diff is in
  `.agents/`. No more tracking policy across `.claude/`, `.openspec/`, and the
  repo root — every AI configuration change is a `.agents/` change.
- **Vendor-neutral.** Nothing here is Claude-Code-specific except the
  `skills/` folder format (which Claude Code supports natively) and the
  `CLAUDE.md` orientation file (which is itself agent-specific by definition).
  Other agents read `AGENTS.md`, point at the same ADRs, and load skills on
  demand if they support the Agent Skills spec.
- **Symlinks only at the AGENTS.md discovery points.** Tools that hard-code
  `AGENTS.md` at the repo root still work (root symlink → `.agents/AGENTS.md`).
  Tools that hard-code `.openspec/AGENTS.md` still work (symlink → `.agents/sdd/AGENTS.md`).
  No symlink is needed for `.claude/skills` — Claude Code is configured to
  look at `.agents/skills/` directly (see below).

## Tool discovery

- **Root `AGENTS.md`** → symlink to `.agents/AGENTS.md`. Tools that hard-code
  `AGENTS.md` at the repo root (Aider, Gemini CLI, the AGENTS.md standard)
  find the universal rulebook without configuration.
- **`.openspec/AGENTS.md`** → symlink to `.agents/sdd/AGENTS.md`. OpenSpec-aware
  tools and humans browsing the `.openspec/` tree find the SDD workflow guide
  where they expect it.
- **`.agents/skills/`** → Claude Code and Agent-Skills-spec-compliant tools
  discover skills here. To make Claude Code find them in this repo, configure
  the project-level skills path in your Claude Code settings (or in your
  machine-level `~/.claude/settings.json`) to include `.agents/skills/`. This
  project's `.agents/CLAUDE.md` documents the canonical configuration.

## Adding to this folder

- **New skill** → create `.agents/skills/<skill-name>/SKILL.md` with the
  required `name` + `description` frontmatter, then reference any templates or
  scripts via relative paths from the skill root.
- **New top-level guidance** → edit `.agents/AGENTS.md` (universal) or
  `.agents/CLAUDE.md` (Claude-Code-specific). Do not create top-level files
  like `CLAUDE.md` or `.claude/` outside this tree.
- **Move a file** → keep the canonical copy in `.agents/`. If a discovery
  point must move, update the symlink.

## What is intentionally NOT here

- Runtime state (`.claude/worktrees/`, `.claude/scheduled_tasks.json`,
  `~/.claude/settings.json`) — these are gitignored and belong to the agent
  runtime, not to the policy.
- The `.harness/` self-improving loop (removed 2026-09-09) — replaced by
  manual review + CI gating.
- The OpenSpec spec archive (`.openspec/specs/`), changelog
  (`.openspec/CHANGELOG.md`), templates (`.openspec/templates/`), and change
  proposals (`.openspec/changes/`) — these are project artifacts, not AI
  configuration.
