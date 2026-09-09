# Workflow OpenSpec — Guia Detalhado para Agentes

> **Local canônico:** `.agents/sdd/AGENTS.md`. O caminho
> `.openspec/AGENTS.md` é um symlink para esta pasta, mantido por
> compatibilidade — veja [`.agents/README.md`](../README.md) para o
> layout completo de tooling de IA.

Este arquivo é a referência canônica para o workflow SDD aplicado
neste repo. Agentes de IA e humanos seguem o mesmo guia.

## Quando usar OpenSpec

**Use OpenSpec para:**

- Qualquer feature nova (visível ao usuário ou interna)
- Qualquer mudança de comportamento existente (endpoints, fluxos de
  UI, regras de negócio, formato de dados)
- Qualquer mudança em contratos públicos (superfície de API, schema
  de banco, tipos compartilhados)

**NÃO use OpenSpec para:**

- Correções de bug cuja spec já descreve corretamente o comportamento
  pretendido (apenas corrija o bug)
- Mudanças cosméticas (typos, formatação, refactors sem impacto de
  comportamento)
- Bumps de versão de dependência sem mudança de comportamento
- Atualizações apenas de documentação

Em caso de dúvida, **use OpenSpec por padrão** — o custo de uma
proposta extra é muito menor que o custo de uma mudança de
comportamento não autorizada.

## Os cinco passos

### 1. Enquadramento do problema

Antes de abrir um proposal, responda em um parágrafo:

- **Qual é o problema?** (Sintoma visível ao usuário ou gap interno)
- **Quem é afetado?** (Quais usuários / sistemas)
- **Por que agora?** (Por que esta é a hora certa de resolver)

### 2. Proposal

Crie `.openspec/changes/<feature-name>/` com estes quatro arquivos:

#### `proposal.md`

Deve conter estas seções (nesta ordem):

- **Por quê** — o problema e o valor de resolvê-lo
- **O que muda** — lista concreta de efeitos visíveis ao usuário ou
  ao sistema
- **Impacto** — quebrado por:
  - Usuários (mudanças de UX, novos fluxos)
  - Sistema (novos endpoints, novas tabelas, novas env vars)
  - Outras features (qualquer coisa que dependa do que está
    mudando)
- **Fora do escopo** — lista explícita do que este proposal NÃO vai
  tocar
- **Riscos** — pelo menos um risco com sua mitigação

#### `tasks.md`

Checklist numerado e executável. Cada item MUST ter uma Definition
of Done clara. Ordene as tarefas de modo que cada uma seja
independentemente verificável.

Exemplo:
```
- [ ] 1. Adicionar o model `Foo` ao schema do Prisma
      DoD: `prisma migrate dev` cria a tabela
- [ ] 2. Implementar `FooService.create()`
      DoD: Teste unit `foo.service.spec.ts` passa
```

#### `design.md`

Decisões técnicas que precisam de explicação. Exemplos:

- Escolha de biblioteca (e o que foi rejeitado)
- Decisões de formato de dados (por que uma coluna JSON vs tabela
  separada)
- Trade-offs de performance
- Considerações de segurança

Pule `design.md` apenas se a proposal for tão pequena que não há
nada para explicar (ex.: adicionar um único endpoint).

#### `specs/<area>/spec.md`

Um documento de delta usando **SHALL/SHOULD/MAY** (RFC 2119). Cada
requisito é uma linha:

```
WHEN um usuário pede reset de senha,
THE system SHALL enviar um e-mail contendo um link único válido por 1 hora,
AND o link SHALL expirar após o primeiro uso.
```

Mantenha curto, testável e inequívoco.

### 3. Revisão

A proposal NÃO está aprovada até que um humano diga explicitamente
que sim. Agentes de IA MUST esperar essa aprovação antes de qualquer
mudança de código.

### 4. Build

Durante a implementação das tarefas, mantenha disciplina de
documentação: JSDoc para trabalho de referência, cross-links de
ADR em `@remarks` para decisões não-óbvias, READMEs de BC
atualizados para novos bounded contexts, runbooks para mudanças de
infra. Revisores checam isso à mão.

Execute as tarefas em ordem. Cada tarefa = um commit (formato
Conventional Commits):

```
feat(api): tarefa 1 - adicionar model PasswordResetToken
feat(api): tarefa 2 - gerar migration
feat(api): tarefa 3 - adicionar schemas Zod para reset de senha
```

Referencie o número da tarefa no corpo do commit para que
revisores possam mapear commits → checklist.

### 5. Arquivamento

Depois que o PR for merged:

1. Mova `.openspec/changes/<feature-name>/specs/<area>/spec.md`
   para `.openspec/specs/<area>/<feature-name>.md`
2. Adicione uma entrada resumida em `.openspec/CHANGELOG.md`
   (data, feature, autor)
3. Apague o restante da pasta de change

Git preserva histórico. A spec arquivada vira a nova fonte da
verdade daquela feature.

## Templates

Veja [`.openspec/templates/`](templates/) para arquivos iniciais.

## Trabalhando em projetos derivados

Quando você clonar este repo para começar um novo projeto:

1. Atualize `package.json` → `name`, `description`, `version`
2. Atualize `.env.example` → segredos, nome do projeto
3. Atualize `README.md` → nome do projeto + quickstart
4. **Mantenha `.agents/` e `.openspec/` intactos** — eles são a
   regra, não o conteúdo
