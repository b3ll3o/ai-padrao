# Contribuindo com ai-padrao

Obrigado por trabalhar em `ai-padrao`. Este guia cobre o cotidiano —
ambiente, fluxo e regras que o build aplica. Para o _porquê_, veja
[`AGENTS.md`](AGENTS.md) e os
[registros de decisão](docs/decisions/README.md).

## 1. Ambiente de dev

Requer:

- Node 22+ (`.nvmrc` / `engines.node` em `package.json`)
- pnpm 9 (`corepack enable` ativa a versão fixada)
- Docker + Docker Compose (para `postgres`, `mailhog`, `otel-collector`)
- Visual Studio Code (recomendado; configuração do workspace em
  `.vscode/`)

Bootstrap de um clone novo:

```bash
git clone <repo-url> my-project
cd my-project
corepack enable
pnpm install
cp .env.example .env
pnpm up           # sobe postgres + mailhog + otel-collector
pnpm db:migrate
pnpm db:seed      # cria admin@ai-padrao.local / admin123
pnpm dev          # turbo roda api + web em paralelo com hot-reload
```

Se o `pnpm install` reclamar de peer deps, veja ADR-001 no
[índice de decisões](docs/decisions/README.md) antes de adicionar
overrides.

## 2. Fluxo (trunk-based, um PR por mudança)

1. Crie branch a partir de `main`. Nomes são livres, mas prefira
   `feat/<slug-curto>` ou `fix/<slug-curto>` por simetria com o
   escopo do commit.
2. Commits focados. Um commit por tarefa do `tasks.md` (veja §3).
3. Abra um PR. A descrição do PR deve referenciar a pasta
   `.openspec/changes/<feature>/` que guiou a mudança.
4. CI precisa estar verde antes do merge. CI roda `pnpm test`,
   `pnpm lint`, `pnpm typecheck`.
5. Squash ou rebase-merge; mantenha `main` linear.

## 3. Mudanças de comportamento exigem OpenSpec (SDD)

Qualquer mudança de comportamento visível ao usuário, contratos
públicos (superfície da API, schema do banco, tipos compartilhados)
ou regras de negócio PRECISA passar pelo OpenSpec **antes** do código
entrar. Veja [`.openspec/AGENTS.md`](.openspec/AGENTS.md) para o
procedimento completo.

O mínimo:

```bash
mkdir -p .openspec/changes/<feature-name>/specs/<area>
# Escreva proposal.md, tasks.md, design.md, specs/<area>/spec.md
# Aguarde aprovação humana na proposal
# Execute tasks.md, um commit por tarefa
# Após merge, arquive conforme §5 de .openspec/AGENTS.md
```

Pule o OpenSpec somente para:

- Mudanças cosméticas (typos, formatação, refactors sem impacto de
  comportamento)
- Bumps de versão de dependência sem mudança de API
- Atualizações só de documentação

Mesmo assim, use Conventional Commits (§5).

## 4. Política de teste — sem testes pulados, nunca

Code reviewers e CI DEVEM varrer todo `.ts/.tsx/.js/.jsx` versionado
em busca de `.skip`, `.todo`, `xit`, `xdescribe`, `--passWithNoTests`
e `passWithNoTests` (vitest/jest). O check falha o build no primeiro
acerto.

Se o teste é flaky, conserte a flakiness. Se o teste está errado,
delete-o e escreva o correto. Se você genuinamente não consegue
manter o teste verde hoje, faça referência ao incidente no PR e
proponha um ADR — **não** comite um `.skip`.

```bash
pnpm test                                 # roda todos os unit + e2e
pnpm --filter @ai-padrao/api test path/to/spec.ts   # roda um teste
```

## 5. Commits — Conventional Commits com escopo

Formato: `<type>(<scope>): <subject>` onde `type` é um de `feat`,
`fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `perf`,
`build`, `revert`. O escopo vem do allowlist em
[`.commitlintrc.json`](.commitlintrc.json):

`root`, `api`, `web`, `contracts`, `db`, `ui`, `config`, `docker`,
`sdd`, `deps`.

Subject curto, lowercase, sem ponto final. O corpo explica o _porquê_;
trailers referenciam tarefas:

```
feat(api): add POST /auth/refresh endpoint

Validates the refresh token, rotates it via Prisma, returns a new
access token in the response body and a new refresh token in the
httpOnly cookie.

Refs: .openspec/changes/refresh-token-rotation/
```

O hook `commit-msg` em `.githooks/` valida o formato via `commitlint`.

## 6. Estilo de código

- **Prettier** é a fonte da verdade para formatação (aspas simples,
  indent de 2 espaços, vírgula trailing). A config mora em
  `packages/config-prettier`. Não brigue com ela.
- **ESLint 9 (flat config)** aplica qualidade de código. As configs
  compartilhadas moram em `packages/config-eslint`. O pacote da api
  adiciona regras específicas do NestJS; o pacote do web adiciona
  regras do React/Next.js.
- **TypeScript** strict em tudo. Sem `any` fora de código gerado;
  sem `@ts-ignore` sem justificativa inline.
- **Limites de módulo:** `apps/web` NÃO PODE importar de `apps/api`
  nem de `@prisma/client`. Apenas `apps/api` pode usar Prisma. Os
  tipos compartilhados moram em `packages/contracts`.

## 7. Adicionando dependências

- Nova dev dep no topo: adicione em `devDependencies` do
  `package.json` raiz e explique no corpo do PR.
- Dep de runtime: adicione em `dependencies` do pacote específico.
  Nunca adicione na raiz.
- Para primitivos de UI, prefira estender `packages/ui` em vez de
  adicionar no app web diretamente.

## 8. Reportando problemas

Abra uma issue no GitHub com:

- Passos para reproduzir (comandos, env vars, SO)
- Esperado vs observado
- Trecho de log relevante (saída de `pnpm logs` para issues de
  backend)

Se a issue é um defeito recorrente, proponha mudança de ADR via
`.openspec/changes/<adr-amendment>/` para que a regra seja
atualizada antes do fix.

## 9. Onde buscar ajuda

- Regras para IA (Claude Code, Gemini CLI, Codex):
  [`.agents/AGENTS.md`](.agents/AGENTS.md) (também na raiz via
  symlink).
- Livro completo de regras: [`.agents/REGRAS.md`](.agents/REGRAS.md).
- Orientação do Claude Code: [`.agents/CLAUDE.md`](.agents/CLAUDE.md).
- Registros de decisão: [`docs/decisions/README.md`](docs/decisions/README.md).
- Fluxo OpenSpec: [`.openspec/AGENTS.md`](.openspec/AGENTS.md)
  (symlink para `.agents/sdd/AGENTS.md`).
- Status do projeto e quickstart: [`README.md`](README.md).

Para ajuda humana, mencione `@<mantenedor>` na issue ou PR.
