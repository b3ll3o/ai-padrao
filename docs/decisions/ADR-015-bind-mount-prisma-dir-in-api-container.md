# ADR-015: Bind-mount de `apps/api/prisma/` no container api em dev

- **Status:** Aceito
- **Date:** 2026-08-04
- **Tipo de decisão:** Decisão proativa de DevOps

## Contexto

Com [`ADR-004`](./ADR-004-dockerfile-copy-schema-before-generate.md)
no lugar, o `Dockerfile` da api roda `pnpm prisma generate` em build
time — então o `PrismaClient` typed existe dentro da imagem.
Funciona. Mas, em dev, a porta de hot-reload é a mesma imagem de
build. Editar `schema.prisma` e re-rodar o dev exige:

1. Rebuild da imagem (copia novo `schema.prisma` no layer, roda
   `prisma generate`).
2. Restart do container api.

Esse ciclo é lento para iteração em schema. Pior: rodar
`prisma migrate dev` de dentro do container gera artefatos
(`migrations/*.sql`, `migrations/migration_lock.toml`) que
ficam **dentro do container**, fora do volume persistido. A
morreria é esquecer o `prisma generate` local após uma migração
rodada via container — o PrismaClient do node_modules local fica
sem tipagem até alguém rodar o comando manualmente.

## Decisão

`infra/docker-compose.yml` bind-mounts o diretório
`apps/api/prisma/` dentro do container api em dev
(`./apps/api/prisma:/app/apps/api/prisma`). O restante da imagem
permanece imutável; só o diretório do Prisma é montado. Hot-reload
do Nest continua via o já-existente volume de source.

Para preservar a ordem do ADR-004 (gerar `Prisma.Client` antes do
build), o entrypoint do container api:

1. Verifica se `node_modules/.prisma/client/index.d.ts` existe e
   é mais novo que `schema.prisma`. Se estiver desatualizado ou
   ausente, roda `pnpm --filter @ai-padrao/api prisma generate`.
2. Inicia `node apps/api/dist/main.js` (produção) ou o dev server
   do Nest (dev hot-reload).

O mesmo check roda no CI antes de `pnpm test:coverage`, então
`prisma generate` é executado uma vez por ambiente, não por
container. Engenheiros rodando local podem também rodar
`pnpm db:generate` (alias de `prisma generate`) — o check no
entrypoint apenas normaliza quem esqueceu.

## Consequências

Positivas:

- Editar `schema.prisma` no host monta imediatamente dentro do
  container; o check de freshness no entrypoint chama
  `prisma generate` automaticamente, então tipagem fica correta
  sem dance manual.
- `prisma migrate dev` dentro do container escreve artefatos no
  host — `migrations/` passa por code review, não some quando o
  container é descartado.
- O resto da imagem api permanece versionado e imutável, então
  os benefícios do ADR-004 ficam preservados.

Negativas / trade-offs:

- Bind-mounts são amarrados ao filesystem do host — em
  ambientes não-Linux/Docker (ex.: Windows sem WSL) o comportamento
  de inode watch é diferente. Aceitamos a fricção porque o
  ambiente-alvo é Linux container-based.
- O check de freshness no entrypoint adiciona ~1-3 s por start
  de container em macOS com HFS bind-mounts. Aceitável para evitar
  o mode-de-falha "tipagem fantasma desatualizada".

## Enforcement

- `infra/docker-compose.yml` declara o bind-mount
  `./apps/api/prisma:/app/apps/api/prisma` no service `api`.
- `apps/api/Dockerfile` ENTRYPOINT executa o check de freshness
  `node_modules/.prisma/client/index.d.ts` vs
  `prisma/schema.prisma` antes de iniciar o app.
- `package.json` da raiz expõe `pnpm db:generate` e
  `pnpm db:migrate`; `pnpm db:migrate` é o workflow suportado
  para criar migrations (roda `prisma migrate dev` dentro do
  container, com o bind-mount persistindo artefatos).
- A skill `dockerfile-copy-schema-before-generate` Gotcha 1
  proíbe rodar `prisma generate` fora do build/entrypoint do
  container.
