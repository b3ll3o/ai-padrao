import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { firstValueFrom, of } from "rxjs";
import { LoggingInterceptor } from "./logging.interceptor";

describe("LoggingInterceptor", () => {
  const buildCtx = (
    headers: Record<string, string | undefined> = {},
    statusCode = 200,
  ) => {
    const header = jest.fn();
    const req = {
      headers,
      method: "GET",
      url: "/api/things",
    };
    const res = { header, statusCode };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext;
    return { ctx, req, res, header };
  };

  const buildHandler = () => {
    const handler: CallHandler = {
      handle: () => of("payload"),
    } as unknown as CallHandler;
    return handler;
  };

  it("usa o header x-request-id recebido quando presente", async () => {
    const { ctx, req } = buildCtx({ "x-request-id": "incoming-id" });
    const result = await firstValueFrom(
      new LoggingInterceptor().intercept(ctx, buildHandler()),
    );
    expect(result).toBe("payload");
    expect((req as unknown as { requestId: string }).requestId).toBe(
      "incoming-id",
    );
  });

  it("emite um uuid quando não há header, escreve em res.header e req.requestId", async () => {
    const { ctx, req, res, header } = buildCtx({});
    await firstValueFrom(
      new LoggingInterceptor().intercept(ctx, buildHandler()),
    );
    expect(header).toHaveBeenCalledWith("x-request-id", expect.any(String));
    expect((req as unknown as { requestId: string }).requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(res.statusCode).toBe(200);
  });

  it("preserva o statusCode na response ao concluir", async () => {
    const { ctx, res } = buildCtx({}, 201);
    await firstValueFrom(
      new LoggingInterceptor().intercept(ctx, buildHandler()),
    );
    expect(res.statusCode).toBe(201);
  });
});
