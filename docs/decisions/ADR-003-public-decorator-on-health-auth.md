# ADR-003 — `@Public()` obrigatório em endpoints de health/auth

- **Status:** Aceito
- **Date:** 2026-08-04

## Contexto

Registramos `JwtAuthGuard` globalmente via `APP_GUARD` para que todo
endpoint seja autenticado por padrão. Sem um opt-out explícito,
endpoints de nível de infraestrutura (`/api/health`, login, register,
refresh) também ficam gated. Probes de health (liveness do
Kubernetes, `HEALTHCHECK` do Docker, agentes de monitoramento) não
carregam JWT — esperam 200. Um endpoint de health globalmente guarded
retorna 401 e marca o pod como unhealthy, causando loops de restart.

## Decisão

Endpoints que precisam ser acessíveis sem autenticação DEVEM carregar
o decorator `@Public()` no nível da classe:

```ts
@Public()
@ApiTags("health")
@Controller("health")
export class HealthController {
  /* ... */
}
```

Obrigatórios: `health`, `auth/login`, `auth/register`, `auth/refresh`.
Sem exceções. Overrides por endpoint não são suportados — `@Public()`
é somente no nível de classe.

## Consequências

- **Mais fácil:** Probes de health funcionam; usuários conseguem se
  autenticar.
- **Mais difícil:** Um novo endpoint não autenticado exige lembrar do
  decorator (mitigado pelo auto-check abaixo).
- **Trade-off:** Aceitar — a alternativa é uma quebra operacional
  difícil de atribuir a um decorator faltando.

## Enforcement

- Skill: `nestjs-fastify-gotchas` Gotcha 4.
- Teste e2e: `apps/api/test/health.e2e-spec.ts` bate em `/api/health`
  sem token e espera 200.
