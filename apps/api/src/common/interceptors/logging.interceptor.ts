import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from "@nestjs/common";
import { Injectable, Logger } from "@nestjs/common";
import type { Observable } from "rxjs";
import { tap } from "rxjs";
import { randomUUID } from "node:crypto";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const requestId =
      (req.headers["x-request-id"] as string | undefined) ?? randomUUID();
    req.requestId = requestId;
    // O reply do Fastify expõe `.header(name, value)` em vez de `setHeader` do Express.
    (res as { header: (name: string, value: string) => void }).header(
      "x-request-id",
      requestId,
    );
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.logger.log(
          `${req.method} ${req.url} ${res.statusCode} ${Date.now() - start}ms [${requestId}]`,
        );
      }),
    );
  }
}
