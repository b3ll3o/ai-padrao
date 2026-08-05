import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { auditExtension } from "./audit/audit-extension";

/**
 * Thin NestJS wrapper around {@link PrismaClient} that activates the
 * `auditExtension` on construction.
 *
 * The extension transparently:
 *  - injects `deletedAt: null` into every read of an audited entity
 *    (see `AUDITED_MODELS`) so soft-deleted rows are invisible to
 *    application code that goes through this service,
 *  - leaves write operations untouched (audit history + version bumping
 *    is the responsibility of the repository layer, which performs the
 *    read / modify / log sequence atomically inside `prisma.$transaction`).
 *
 * Implementation notes:
 *  - We `extends PrismaClient` so existing call sites
 *    (`this.user.findUnique(...)`, `this.$transaction(...)`) keep compiling
 *    without changes.
 *  - At construction time we build the *extended* client and copy its
 *    model accessors (`user`, `userHistory`, ...) onto `this`.
 *  - The lifecycle hooks (`$connect`, `$disconnect`, `$transaction`) are
 *    rebound to the extended instance so Prisma's internal state lives on
 *    the right `this`.
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
    // Copy model accessors and any other own properties of the extended
    // proxy onto `this`. Object.assign only iterates own enumerable props,
    // which is what we want — we DO NOT want to overwrite lifecycle hooks
    // from the prototype (those need explicit re-binding below).
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
