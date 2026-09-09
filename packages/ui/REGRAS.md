# Regras de `packages/ui`

> **Regras do monorepo:** [`../../.agents/REGRAS.md`](../../.agents/REGRAS.md)
> são a fonte da verdade. Este arquivo **estende** (nunca enfraquece) as
> regras raiz e foca no pacote `ui`.

Pacote de **primitivos de UI** baseados em shadcn/ui + Tailwind 4.
Componentes puros, agnósticos de feature, reusados por `apps/web`
(servidor e cliente) e por qualquer futuro consumidor interno.

## Índice

1. [O que vive aqui](#1-o-que-vive-aqui)
2. [Princípios](#2-principios)
3. [Estrutura de pastas](#3-estrutura-de-pastas)
4. [Estilo e tokens](#4-estilo-e-tokens)
5. [Acessibilidade](#5-acessibilidade)
6. [Variantes e composição](#6-variantes-e-composicao)
7. [Server vs Client Components](#7-server-vs-client-components)
8. [Testes](#8-testes)
9. [Checklist de PR](#9-checklist-de-pr)

---

## 1. O que vive aqui

- Componentes primitivos: `Button`, `Input`, `Card`, `Dialog`,
  `Dropdown`, `Toast`, `Form`, `Table`, etc.
- Primitivos CSS/Tailwind (utilitários `cn()`, `cN()`,
  variantes em CVA).
- Tokens de tema (cores, espaçamentos, sombras) via variáveis CSS.
- Helpers agnósticos de acessibilidade (`useId`, focus trap,
  `RovingFocus`).
- **Não** vive aqui: páginas, fluxos, integrações com API,
  componentes acoplados a uma feature específica.

## 2. Princípios

- **Composição sobre configuração:** prefira `children` + slot
  components (`Card.Header`, `Card.Title`, `Card.Body`) a props
  booleanas que explodem em combinações.
- **Stateless quando possível.** Estado fica no consumidor; o
  primitivo expõe `value`/`onChange` controlado.
- **Sem dependências de domínio.** Não importe de
  `packages/contracts` nem de qualquer `features/*`.
- **Sem dependências diretas de feature do web.** Use contratos
  genéricos (data-attributes, ARIA) e deixe feature-specific
  behavior para o consumidor.
- **i18n pronto:** mensagens e labels em pt-br por padrão, mas o
  componente aceita `aria-label`, `placeholder` e textos via
  props quando o consumidor precisar traduzir.

## 3. Estrutura de pastas

```text
packages/ui/src/
├── components/
│   ├── button/
│   │   ├── button.tsx
│   │   ├── button.stories.tsx
│   │   ├── button.test.tsx
│   │   └── index.ts
│   └── ...
├── lib/
│   ├── cn.ts          # utilitário class-merge
│   └── variants.ts    # helpers de CVA
├── tokens.css         # CSS variables (tema)
└── index.ts           # barrel export
```

- Cada componente vive em uma pasta com `index.ts` próprio —
  evita importar arquivos internos.
- `.stories.tsx` é o catálogo visual (Storybook quando aplicável,
  ou Ladle/MDX).
- `.test.tsx` cobre comportamento e acessibilidade.

## 4. Estilo e tokens

- **Tailwind 4** com CSS-first config. Variáveis de tema em
  `tokens.css` (`--color-background`, `--radius-card`).
- Cores **nunca hardcoded** no JSX — use classes Tailwind que
  referenciam tokens (`bg-background`, `text-foreground`,
  `border-input`). Suporte a dark mode via `data-theme` ou
  `prefers-color-scheme`.
- Use `cn()` para merge de classes (`clsx` + `tailwind-merge`).
  Ordem: classes estáticas primeiro, depois `cn()` com
  condições.
- Espaçamentos e raios vêm de tokens (`p-4`, `rounded-md`),
  nunca valores literais arbitrários no JSX.

## 5. Acessibilidade

- Cada componente interativo expõe os atributos ARIA corretos
  (`role`, `aria-*`, foco visível, navegação por teclado).
- Modais/dropdowns implementam **focus trap** + `Esc` para
  fechar; restaurar foco ao fechar.
- Inputs têm rótulo associado (`htmlFor`+`id` ou `aria-labelledby`)
  e mensagens de erro em `aria-describedby`.
- Texto de botões-ícones (`<Button><Icon/></Button>`) recebe
  `aria-label` descritivo.
- Contraste mínimo AA verificado. Foco visível com ring
  (`focus-visible:ring-2 focus-visible:ring-ring`).
- Listas/tabelas usam a semântica HTML correta (`<ul>`,
  `<table>`, `<th scope="col">`).
- Imagens decorativas com `alt=""`; imagens informativas com
  `alt` descritivo.

## 6. Variantes e composição

- Use `class-variance-authority` (CVA) quando o componente tiver
  mais de 3 estilos relevantes (`size`, `variant`, `intent`).
- Não exponha `as`/`asChild` indiscriminadamente — só quando a
  composição for genuinamente útil (Slot).
- Subcomponentes exportados em namespace quando fizer sentido
  (`Card.Header`, `Dialog.Title`).

## 7. Server vs Client Components

- Primitivos **devem ser Server-friendly por padrão**: sem
  `"use client"` no topo.
- Quando o primitivo precisar ser Client (refs para animação,
  context de foco, dropdowns), exponha **dois arquivos**:
  `<Component>.tsx` (Server) e `<Component>.client.tsx`
  (Client) — só a versão client marca `"use client"`.
- Não passe callbacks não-serializáveis para Server Components.

## 8. Testes

- Cada componente tem `.test.tsx` com `@testing-library/react`:
  renderiza a árvore real (sem `jest.mock` do componente
  interno).
- Cobre: variantes principais (size/intent), estados de foco,
  navegação por teclado, mensagens de erro e ARIA attributes.
- Storyshots para paridade visual quando houver Storybook.
- Acessibilidade testada com `axe` ou `@axe-core/react` quando
  aplicável; falha o teste em violação AA.

## 9. Checklist de PR

- [ ] Componente com JSX, teste e (opcional) stories.
- [ ] Sem dependência de domínio ou feature específica.
- [ ] Atributos ARIA corretos; navegação por teclado funcional.
- [ ] Cores e espaçamentos via tokens, nunca hardcoded.
- [ ] Sem `console.*` em runtime.
- [ ] Sem `.skip`/`.todo`/`xit`/`xdescribe` (regra raiz).
- [ ] `pnpm --filter @ai-padrao/ui typecheck`, `lint` e `test`
      verdes.
- [ ] Barrel `packages/ui/src/index.ts` atualizado quando há
      componente novo.
