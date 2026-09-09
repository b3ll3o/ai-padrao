# .githooks — Git Hooks Locais

Esta pasta guarda Git hooks locais que vêm com o repositório. Eles
são **opt-in**: um clone novo não os roda até você conectá-los.

## Instalação (uma vez por clone)

```bash
pnpm postmerge:install
```

Isso define `core.hooksPath` como `.githooks` apenas para o clone
local. Execuções de CI não são afetadas.

## Desativar (por clone)

```bash
git config --local --unset core.hooksPath
```

Os hooks são versionados para que cada clone receba a mesma
experiência de setup, mas não se ativam sozinhos — você precisa
rodar `pnpm postmerge:install` uma vez.

## O que está aqui

| Hook          | Quando dispara                          | O que faz                                                                       |
| ------------- | --------------------------------------- | ------------------------------------------------------------------------------- |
| `pre-push`    | Antes de cada `git push`                | Roda varredura de secret-shape em `*.ts`/`*.tsx`/`*.js`/`*.jsx` e bloqueia o push se encontrar |
| `post-merge`  | Após cada merge bem-sucedido (incl. `pull`) | Roda `pnpm install --frozen-lockfile` quando `pnpm-lock.yaml` mudou             |

## Adicionando um hook novo

1. Escreva o script do hook nesta pasta.
2. Atualize a tabela acima.
3. Abra uma change OpenSpec em
   `.openspec/changes/<feature>/` descrevendo o comportamento do
   novo hook.
4. Adicione o novo hook ao setup de `core.hooksPath` (sem etapa de
   instalação por hook — a pasta inteira é conectada de uma vez).

## Por que uma pasta separada, não `.git/hooks/`

`.git/hooks/` é por clone e não é versionado. Manter hooks em
`.githooks/` os deixa sob controle de versão enquanto ainda são
opt-in via `core.hooksPath`.
