# ADR-006 — Use o `Logger` do Nest, não `console.*`, em `main.ts`

- **Status:** Aceito
- **Date:** 2026-08-04

## Contexto

O NestJS vem com `Logger` (e o `Logger` contextual passado a services
via `new Logger(Service.name)`). Ele escreve através do Pino (quando
configurado) e respeita log levels, modo JSON e redação. `console.log`
em `apps/api/src/main.ts` ignora tudo isso — o log level é
hardcoded como "sempre imprime", o formato structured-log é perdido
e a redação não roda. Pior: em produção, um `console.log("user:",
user)` solto vira vazamento de PII.

## Decisão

`apps/api/src/main.ts` DEVE usar o `Logger` do Nest para toda linha
de log de startup. Arquivos de nível de service (controllers, guards,
interceptors) DEVEM `new Logger(Name)` no topo da classe e usar
`this.logger`. `console.log|warn|error|info|debug` cru é proibido em
`main.ts` e desencorajado em todo lugar (exceto arquivos de setup de
teste).

```ts
import { Logger } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger)); // ponte pino em prod
  await app.listen(3000);
  Logger.log("API listening on :3000", "Bootstrap");
}
```

## Consequências

- **Mais fácil:** Logs estruturados fluem para o mesmo sink que logs
  de request; redação funciona; filtros de log level aplicam.
- **Mais difícil:** `console.log` para debug-print não é mais
  gratuito — devs recorrem a `Logger.debug` e esquecem de habilitar
  o nível debug.
- **Trade-off:** Aceitar — risco de PII e regressões de qualidade de
  log valem o atrito.

## Enforcement

- Skill: `nestjs-fastify-gotchas` Gotcha 3.
