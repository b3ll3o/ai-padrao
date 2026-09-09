# `.agents/` — Ferramental e regras de IA (canônico)

Esta pasta é a **casa canônica** de tudo que existe para instruir,
guiar ou estender assistentes de codificação com IA (Claude Code,
Gemini CLI, Codex, Aider, Copilot, Cursor etc.) que atuam neste
repositório. O projeto segue a
[convenção AGENTS.md](https://agents.md/) e a
[especificação Agent Skills](https://agentsskills.io/specification);
as duas estão materializadas nesta árvore única. Não há `.claude/`,
`CLAUDE.md` nem outro arquivo específico de agente na raiz — tudo
mora aqui.

## Layout

| Caminho | Propósito | Lido por |
| --- | --- | --- |
| [`AGENTS.md`](AGENTS.md) | Portão de entrada — links para o livro de regras e o fluxo SDD. | Todos os agentes. O `AGENTS.md` da raiz é um symlink para ferramentas que procuram lá. |
| [`REGRAS.md`](REGRAS.md) | Livro completo de regras do monorepo (SDD, idioma pt-br, sem testes pulados, sem secrets, glossário). | Todos os agentes e humanos. |
| [`CLAUDE.md`](CLAUDE.md) | Orientação específica do Claude Code — identidade, arquitetura, ADRs, config de editor/IA, expectativas de fluxo. | Claude Code (e qualquer agente que queira dicas específicas). |
| [`skills/`](skills/) | Skills — expertise invocável para tarefas específicas. Cada skill é uma pasta com `SKILL.md` (frontmatter + corpo) e subpastas opcionais `templates/`, `scripts/`, `references/`, `assets/`. | Claude Code descobre via `.agents/skills/` por padrão neste repo (veja "Tool discovery" abaixo). |
| [`sdd/AGENTS.md`](sdd/AGENTS.md) | Regras do fluxo SDD — templates de proposal/tasks/design/spec, procedimento de archive, ciclo de vida da change. | Agentes com awareness de OpenSpec; `.openspec/AGENTS.md` é um symlink para ferramentas que ainda esperam encontrá-lo lá. |

## Por que este layout

- **Uma árvore, um diff.** Quando você adiciona ou muda uma política,
  o diff está em `.agents/`. Nada mais de rastrear política entre
  `.claude/`, `.openspec/` e a raiz do repo — toda mudança de
  configuração de IA é uma mudança em `.agents/`.
- **Vendor-neutral.** Nada aqui é específico do Claude Code, exceto
  o formato da pasta `skills/` (que o Claude Code suporta nativamente)
  e o arquivo de orientação `CLAUDE.md` (que por definição é
  específico de um agente). Outros agentes leem `AGENTS.md`, apontam
  para os mesmos ADRs e carregam skills sob demanda se suportarem
  a spec de Agent Skills.
- **Symlinks apenas nos pontos de descoberta do AGENTS.md.**
  Ferramentas que hard-codam `AGENTS.md` na raiz do repo ainda
  funcionam (symlink da raiz → `.agents/AGENTS.md`). Ferramentas que
  hard-codam `.openspec/AGENTS.md` ainda funcionam (symlink →
  `.agents/sdd/AGENTS.md`). Nenhum symlink é necessário para
  `.claude/skills` — o Claude Code é configurado para olhar
  `.agents/skills/` diretamente (veja abaixo).

## Tool discovery

- **`AGENTS.md` da raiz** → symlink para `.agents/AGENTS.md`.
  Ferramentas que hard-codam `AGENTS.md` na raiz do repo (Aider,
  Gemini CLI, o padrão AGENTS.md) encontram o livro de regras sem
  configuração.
- **`.openspec/AGENTS.md`** → symlink para
  `.agents/sdd/AGENTS.md`. Ferramentas e humanos com awareness de
  OpenSpec encontram o guia do fluxo SDD onde esperam.
- **`.agents/skills/`** → Claude Code e ferramentas compatíveis com
  a spec de Agent Skills descobrem skills aqui. Para fazer o Claude
  Code encontrá-las neste repo, configure o `skillsPaths` em
  `~/.claude/settings.json` (nível de máquina) para incluir
  `.agents/skills`. O arquivo `.agents/CLAUDE.md` deste projeto
  documenta a configuração canônica.

## Adicionando coisas a esta pasta

- **Nova skill** → crie `.agents/skills/<skill-name>/SKILL.md` com
  o frontmatter `name` + `description`, e referencie templates ou
  scripts via paths relativos a partir da raiz da skill.
- **Nova orientação top-level** → edite `.agents/AGENTS.md`
  (universal) ou `.agents/CLAUDE.md` (específico do Claude Code).
  Não crie arquivos top-level como `CLAUDE.md` ou `.claude/` fora
  desta árvore.
- **Mover um arquivo** → mantenha a cópia canônica em `.agents/`.
  Se um ponto de descoberta precisar se mover, atualize o symlink.

## O que intencionalmente NÃO está aqui

- Estado de runtime (`.claude/worktrees/`,
  `.claude/scheduled_tasks.json`, `~/.claude/settings.json`) — são
  gitignored e pertencem ao runtime do agente, não à política.
- O loop auto-aprimorador `.harness/` (removido em 2026-09-09) —
  substituído por revisão manual + gating de CI.
- O arquivo de specs do OpenSpec (`.openspec/specs/`), changelog
  (`.openspec/CHANGELOG.md`), templates (`.openspec/templates/`) e
  proposals de change (`.openspec/changes/`) — são artefatos do
  projeto, não configuração de IA.
