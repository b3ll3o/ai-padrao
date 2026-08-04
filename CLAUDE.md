# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

This repository (`ai-padrao`) is freshly initialized — the only tracked file is `README.md`, which contains only the project name. There is no source code, no manifest (`package.json`, `pyproject.toml`, etc.), no build/lint/test tooling, and no `.cursor/rules/` or `.github/copilot-instructions.md` to inherit from yet.

When scaffolding the project, populate this file with the commands and architecture notes below as the codebase takes shape.

## Sibling Repositories (for context)

Located alongside this repo in `/home/leo/Documentos/projetos/`:

- `api-padrao/` — appears to be the backend reference implementation this project may mirror or evolve from. Inspect it before adding tooling choices so conventions stay aligned.
- `pedi-ai/`, `pedi-ai-templates/`, `ponto-zero/` — unrelated sibling projects; do not assume shared conventions unless explicitly stated.

## What Future CLAUDE.md Sections Should Cover

Once code lands, add the following sections (do not invent content before it exists):

1. **Common commands** — build, lint, format, test, dev server, single-test invocation. Pull these from the actual manifest and scripts; do not guess.
2. **High-level architecture** — only the "big picture" that requires reading multiple files to understand (e.g., module boundaries, request flow, persistence layer). Skip anything discoverable by `ls`.
3. **Conventions unique to this repo** — naming, error-handling, logging, dependency-injection patterns. Anything generic (write tests, add types) goes unsaid.
4. **Cursor / Copilot rules** — if `.cursor/rules/` or `.github/copilot-instructions.md` are added, summarize the non-obvious parts here.