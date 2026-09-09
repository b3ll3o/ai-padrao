# ADR-005 — Host ports fora do padrão em `docker-compose.yml`

- **Status:** Aceito
- **Date:** 2026-08-04

## Contexto

`docker-compose.yml` padronizava `1025:1025` e `8025:8025` para MailHog
(SMTP + web UI). Essas são portas bem-conhecidas com as quais
qualquer cliente SMTP local ou sessão de browser colide. Quando um
desenvolvedor já roda MailHog ou um relay corporativo nessas portas,
o bind falha silenciosamente e o container sai sem mostrar a causa.
Documentos de onboarding foram escritos assumindo "MailHog está em
8025" — e essa suposição só era verdadeira na máquina do autor
original.

## Decisão

Host ports em `docker-compose.yml` DEVEM ser fora do padrão para
qualquer serviço cujo default upstream colidiria com outras
ferramentas locais:

```yaml
services:
  mailhog:
    ports:
      - "11025:1025" # SMTP — fora do padrão no host
      - "18025:8025" # Web UI — fora do padrão no host
```

Escolha uma porta de host ≥ 10000 para tornar a mudança óbvia.
Documente a porta de host real em `.env.example` e no quickstart do
`README.md` do projeto. Não faça bind do default upstream no host
mesmo que o default do container seja o mesmo.

## Consequências

- **Mais fácil:** Novos contribuidores não colidem com serviços já
  rodando. Falhas de mismatch de porta ficam óbvias.
- **Mais difícil:** A pergunta "em que porta está o MailHog?" exige
  ler o README em vez de chutar 8025.
- **Trade-off:** Aceitar — colisões de porta local desperdiçaram
  horas no time; esta é uma mudança única.

## Enforcement

- Skill: `pnpm-monorepo-script-pitfalls` Pitfall 5.
