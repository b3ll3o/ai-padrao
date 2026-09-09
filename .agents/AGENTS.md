# ai-padrao — Orientação para Agentes de IA

> **Local canônico:** `.agents/AGENTS.md`. O `AGENTS.md` da raiz é um
> symlink para esta pasta — veja [`.agents/README.md`](README.md) para o
> layout da árvore de tooling de IA (skills, regras, SDD, etc.).

Este arquivo é lido pelo Claude Code, Gemini CLI, Codex e qualquer outra
assistente de IA que atue neste repositório. (O time usa Visual Studio
Code como editor de referência; as configurações do workspace ficam em
`.vscode/`.)

Para IA, o **primeiro passo** é ler os três arquivos abaixo — eles são a
fonte da verdade para o que pode e o que não pode ser feito aqui:

1. **[`.agents/REGRAS.md`](REGRAS.md)** — livro de regras completo do
   monorepo (SDD, **SDA**, idioma pt-br, sem testes pulados, sem secrets, etc.).
2. **[`.agents/sdd/AGENTS.md`](sdd/AGENTS.md)** — procedimento SDD /
   OpenSpec (especificação → aprovação → tarefas → archive).
3. **§2 SDA** em REGRAS.md — como executar as tasks após a aprovação
   (subagente fresco por task, revisão entre tasks).

As regras locais abaixo complementam (e nunca enfraquecem) o livro raiz:

- [`apps/api/AGENTS.md`](../../apps/api/AGENTS.md) — regras do app api
  (contextos delimitados, ports/adapters NestJS, regras de teste).
- [`apps/web/AGENTS.md`](../../apps/web/AGENTS.md) — regras do app web
  (feature contexts, presentation/infra, regras de teste).

## Comandos comuns

```bash
pnpm up               # sobe todos os serviços Docker
pnpm down             # para os serviços
pnpm logs             # tail dos logs
pnpm db:migrate       # aplica migrations Prisma (no container da api)
pnpm db:seed          # popula usuário admin
pnpm test             # roda testes unit + e2e em todos os pacotes
pnpm lint             # lint em todos os pacotes
pnpm typecheck        # type-check em todos os pacotes
```

Mais detalhes do fluxo de comandos de cada app: [`CONTRIBUTING.md`](../../CONTRIBUTING.md) e [`apps/api/AGENTS.md`](../../apps/api/AGENTS.md) · [`apps/web/AGENTS.md`](../../apps/web/AGENTS.md).

## Estrutura da pasta `.agents/`

```text
.agents/
├── AGENTS.md        # este arquivo (orientação rápida)
├── REGRAS.md        # livro de regras completo do monorepo
├── CLAUDE.md        # notas específicas do Claude Code
├── README.md        # layout de skills + convenções
├── sdd/             # fluxo OpenSpec/SDD (proposal → tasks → archive)
└── skills/          # Agent Skills (SKILL.md por skill)
    └── ddd-hexagonal/
        ├── SKILL.md
        ├── CHECKLIST.md
        └── templates/
```

Para descobrir skills além desta lista, rode em qualquer pasta do
repositório:

```bash
ls .agents/skills/*/SKILL.md
```

## Atalho: regras mais cobradas

Se você só puder ler três seções do [`.agents/REGRAS.md`](REGRAS.md), leia
nesta ordem:

1. [§4 Ações proibidas](REGRAS.md#4-acoes-proibidas) — lista do que
   **não fazer**, em qualquer situação.
2. [§5 Idioma padrão](REGRAS.md#5-idioma-padrao-pt-br) — toda prosa do
   projeto é pt-br; exceções técnicas listadas.
3. [§9 Pirâmide de testes obrigatória](REGRAS.md#9-piramide-de-testes-obrigatoria) —
   80% unit + integração + e2e para todo fluxo. Tolerância zero a
   `.skip`/`xit`/etc. (também §8).

Para implementar uma change OpenSpec aprovada (ou um plano
`docs/superpowers/plans/<plan>.md`), leia também:
[§2 SDA — Subagent-Driven Architecture](REGRAS.md#2-sda--subagent-driven-architecture-complemento-ao-sdd)
— define o formato do handoff task-por-task.

Em caso de dúvida sobre uma ação específica, abra
[`REGRAS.md`](REGRAS.md) antes de agir.
