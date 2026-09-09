# ADR-001 — Usar a API de reply do Fastify, não a `ServerResponse` do Node

- **Status:** Aceito
- **Date:** 2026-08-04

## Contexto

No NestJS sob `FastifyAdapter`,
`context.switchToHttp().getResponse()` retorna um `FastifyReply` do
Fastify, não um `http.ServerResponse` do Node. Escrever interceptors,
middleware ou decorators que chamam métodos de response do Node
(`res.setHeader`, `res.cookie`, `res.send`) compila limpo, passa em
testes unit que mockam o response, e explode em runtime com erros
"is not a function" — assim que tráfego real chega.

## Decisão

Em qualquer arquivo sob `apps/api/src/` que obtenha o response HTTP a
partir do execution context do NestJS, use as APIs `reply.header(name,
value)` e `reply.send(payload)` do Fastify. Tipa o response como
`FastifyReply` (importado de `fastify`) e documente qualquer chamada
cross-API.

Uma regra mental rápida: se a variável se chamava `res`, renomeie para
`reply` e troque todo método para o equivalente Fastify.

## Consequências

- **Mais fácil:** Interceptors e guards compilam contra o response
  real; falhas surgem em type-check, não em runtime.
- **Mais difícil:** Padrões emprestados de middleware Express exigem
  tradução manual.
- **Trade-off:** Aceitar — a alternativa (silenciosamente errado em
  runtime) é estritamente pior; já vivemos isso.

## Enforcement

- Skill: `nestjs-fastify-gotchas` Gotcha 2.
