# Delta de spec de arquitetura

## Requisitos ADICIONADOS

### Requisito: Direção de dependência para dentro

Ambos os apps SHALL organizar capacidades de negócio como contextos verticais.
Código de domínio SHALL NOT importar frameworks ou infrastructure, e código de
aplicação SHALL depender de capacidades outbound através de ports.

#### Cenário: Validação de import de domínio da api

- **WHEN** o lint roda contra um arquivo de domínio ou aplicação da api
- **THEN** imports de NestJS, Fastify, Prisma ou caminhos de infrastructure falham

#### Cenário: Validação de import de domínio do web

- **WHEN** o lint roda contra um arquivo de domínio ou aplicação do web
- **THEN** imports de React, Next.js, browser APIs ou caminhos de infrastructure falham

### Requisito: Gates de cobertura independentes

Cada app SHALL aplicar pelo menos 80% de statements, branches, functions e lines.

#### Cenário: Uma métrica está abaixo de 80%

- **WHEN** o comando de cobertura de um app reporta qualquer métrica abaixo de 80%
- **THEN** esse comando e o comando raiz agregado falham

#### Cenário: Ambos os apps atingem todos os thresholds

- **WHEN** ambos os comandos de cobertura de app reportam as quatro métricas iguais ou acima de 80%
- **THEN** o comando de cobertura agregado sucede

### Requisito: Preservação de contratos

A migração SHALL preservar rotas da API, status codes, contratos Zod, nomes de
cookie, claims de JWT, comportamento de rotação de token e rotas web existentes.
