import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { auditExtension } from "./audit/audit-extension";

/**
 * Wrapper fino de NestJS em torno do {@link PrismaClient} que ativa a
 * `auditExtension` na construção.
 *
 * A extension, transparentemente:
 *  - injeta `deletedAt: null` em cada leitura de uma entity auditada
 *    (veja `AUDITED_MODELS`), de modo que linhas soft-deleted sejam
 *    invisíveis para o código da Application que passa por este service,
 *  - deixa as operações de escrita intocadas (histórico de audit +
 *    incremento de version é responsabilidade da camada de Repository,
 *    que executa a sequência read / modify / log atomicamente dentro de
 *    `prisma.$transaction`).
 *
 * Notas de implementação:
 *  - Usamos `extends PrismaClient` para que os call sites existentes
 *    (`this.user.findUnique(...)`, `this.$transaction(...)`) continuem
 *    compilando sem mudanças.
 *  - No momento da construção, montamos o client *extendido* e copiamos
 *    seus acessores de model (`user`, `userHistory`, ...) para `this`.
 *  - Os hooks de lifecycle (`$connect`, `$disconnect`, `$transaction`) são
 *    religados à instância estendida para que o estado interno do Prisma
 *    viva no `this` correto.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly extended: any;

  constructor() {
    super();

    this.extended = (this as unknown as PrismaClient).$extends(auditExtension);
    // Copia os acessores de model e quaisquer outras propriedades próprias
    // do proxy estendido para `this`. Object.assign itera apenas pelas
    // próprias propriedades enumeráveis, que é o que queremos — NÃO
    // queremos sobrescrever os hooks de lifecycle do prototype (esses
    // precisam de re-bind explícito abaixo).
    Object.assign(this, this.extended);
    Object.defineProperty(this, "$connect", {
      value: this.extended.$connect.bind(this.extended),
      writable: true,
      configurable: true,
    });
    Object.defineProperty(this, "$disconnect", {
      value: this.extended.$disconnect.bind(this.extended),
      writable: true,
      configurable: true,
    });
    Object.defineProperty(this, "$transaction", {
      value: this.extended.$transaction.bind(this.extended),
      writable: true,
      configurable: true,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
