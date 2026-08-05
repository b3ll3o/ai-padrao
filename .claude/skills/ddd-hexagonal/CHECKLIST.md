# CHECKLIST — Bounded Context Self-Check

Rodar todos os itens antes de pedir review da feature. Cada `✓` significa verificado; cada `✗` significa corrigir antes de pedir review.

## 1. Domain purity

- [ ] `apps/api/src/contexts/<ctx>/domain/` NÃO importa `@nestjs/*`
  ```bash
  grep -rn "@nestjs" apps/api/src/contexts/<ctx>/domain/
  # Expected: empty output
  ```
- [ ] `apps/api/src/contexts/<ctx>/domain/` NÃO importa `@prisma/*`
  ```bash
  grep -rn "@prisma" apps/api/src/contexts/<ctx>/domain/
  # Expected: empty output
  ```
- [ ] Toda entity tem invariantes validadas no construtor (sem setters crus)
- [ ] Value Objects são imutáveis (sem setters, retornam nova instância)

## 2. Application layer

- [ ] Cada use case tem `*.spec.ts` correspondente
  ```bash
  diff <(find apps/api/src/contexts/<ctx>/application/use-cases -name '*.use-case.ts' | sort) \
       <(find apps/api/src/contexts/<ctx>/application/use-cases -name '*.spec.ts' \
          | sed 's/\.spec\.ts$/.use-case.ts/' | sort)
  # Expected: no diff
  ```
- [ ] Use cases recebem port via construtor (NÃO `new PrismaXRepository()` direto)
- [ ] `application/` NÃO importa `@prisma/client`
  ```bash
  grep -rn "@prisma" apps/api/src/contexts/<ctx>/application/
  # Expected: empty output
  ```

## 3. Infrastructure (persistence)

- [ ] Mapper (`<entity>.mapper.ts`) existe para cada entity persistida
- [ ] Adapter (`prisma-<entity>.repository.ts`) implementa a port declarada em `domain/ports/`
- [ ] Mapper tem `*.spec.ts` (roundtrip puro)
- [ ] Adapter tem `*.spec.ts` (com DB de teste)
- [ ] Domain events só são emitidos pelo aggregate, não pelo adapter Prisma

## 4. HTTP layer

- [ ] Controller usa `@Body() dto: X` com tipo derivado de schema Zod de `packages/contracts/src/`
- [ ] DTO NÃO duplica schema Zod — reusa via `z.infer<typeof X>`
- [ ] `@Public()` aplicado em endpoints que não precisam de auth
- [ ] Controller não contém lógica de negócio (delega para use case)
- [ ] Controller tem `*.spec.ts` (e2e via Supertest)

## 5. Module wiring

- [ ] `<ctx>-context.module.ts` registrado em `apps/api/src/app.module.ts`
- [ ] DI tokens são `Symbol` declarados em `<ctx>-context.tokens.ts` (não string, não classe concreta)
- [ ] Cada port tem binding: `{ provide: X_PORT, useClass: PrismaXRepository }`
- [ ] `import type` proibido em qualquer arquivo de DI (controllers, services, guards, strategies) — INC-003

## 6. Tests

- [ ] Zero `.skip` / `.todo` / `--passWithNoTests` (INC-012)
  ```bash
  grep -rn "\.skip\|\.todo\|passWithNoTests" apps/api/src/contexts/<ctx>/
  # Expected: empty output
  ```
- [ ] E2e em `apps/api/test/<ctx>.e2e-spec.ts` exercita ao menos 1 happy path + 1 erro por rota
- [ ] `*.spec.ts` existe para cada entity, value object, use case, mapper e adapter

  ```bash
  find apps/api/src/contexts/<ctx> -name '*.spec.ts' | wc -l
  # Expected: ≥ 1 por entity + ≥ 1 por value object + 1 por use case + 1 por mapper + 1 por adapter
  ```

---

**Status:** [ ] all green — ready for review

Data: _______________
Revisor: _______________
