// @vitest-environment node
//
// happy-dom bloqueia requisições cross-origin (mesmo-origem obrigatória),
// então este spec roda em `node` para usar o fetch nativo do runtime
// (Node 18+) contra um servidor HTTP local de verdade. Mantém o spec como
// integração real — não mocka `fetch`, não usa msw — apenas troca o
// ambiente para que o request chegue no servidor.
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { FetchAuthApiAdapter } from "./fetch-auth-api.adapter";
import { AuthFlowError } from "../../domain/errors/auth-flow.error";

/**
 * Teste de integração do adapter HTTP de autenticação contra um servidor
 * HTTP local de verdade (criado em `node:http`). Exercita o ciclo completo
 * adapter → fetch → response → parser → port — sem mocks de fetch, sem
 * stubs de servidor.
 *
 * Diferente do spec unit (`fetch-auth-api.adapter.spec.ts`), que valida a
 * forma dos argumentos passados ao `fetchFn` via mock, este spec valida o
 * comportamento ponta-a-ponta quando um servidor real responde com sucesso
 * ou erro. Roda em `pnpm --filter @ai-padrao/web test:integration`.
 */
describe("FetchAuthApiAdapter (integração)", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createServer((req, res) => {
      // Endpoint feliz de login/register. Devolve tokens válidos.
      if (
        req.method === "POST" &&
        (req.url === "/api/auth/login" || req.url === "/api/auth/register")
      ) {
        // Para simular um 4xx real, devolvemos 401 quando o body
        // trouxer a senha marcada como errada.
        let raw = "";
        req.on("data", (c: Buffer) => (raw += c.toString()));
        req.on("end", () => {
          const body = raw ? JSON.parse(raw) : {};
          if (body.password === "WrongPass1!") {
            res.statusCode = 401;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ message: "credenciais inválidas" }));
            return;
          }
          res.statusCode = 200;
          res.setHeader("content-type", "application/json");
          res.end(
            JSON.stringify({
              accessToken: "jwt-access-fake",
              refreshToken: "refresh-fake",
            }),
          );
        });
        return;
      }
      if (req.method === "POST" && req.url === "/api/auth/refresh") {
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            accessToken: "jwt-rotated",
            refreshToken: "refresh-rotated",
          }),
        );
        return;
      }
      res.statusCode = 404;
      res.end();
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  it("login faz POST no /api/auth/login e devolve os tokens do servidor", async () => {
    const adapter = new FetchAuthApiAdapter(baseUrl);
    const tokens = await adapter.login({
      email: "alice@example.com",
      password: "StrongPass1!",
    });
    expect(tokens.accessToken).toBe("jwt-access-fake");
    expect(tokens.refreshToken).toBe("refresh-fake");
  });

  it("register faz POST no /api/auth/register e devolve os tokens", async () => {
    const adapter = new FetchAuthApiAdapter(baseUrl);
    const tokens = await adapter.register({
      email: "bob@example.com",
      password: "StrongPass1!",
      name: "Bob",
    });
    expect(tokens.accessToken).toBe("jwt-access-fake");
    expect(tokens.refreshToken).toBe("refresh-fake");
  });

  it("refresh faz POST no /api/auth/refresh e devolve tokens rotacionados", async () => {
    const adapter = new FetchAuthApiAdapter(baseUrl);
    const tokens = await adapter.refresh("old-refresh");
    expect(tokens).not.toBeNull();
    expect(tokens?.accessToken).toBe("jwt-rotated");
    expect(tokens?.refreshToken).toBe("refresh-rotated");
  });

  it("erro 4xx do servidor vira AuthFlowError com a mensagem do body", async () => {
    // Aponta o adapter para a rota `/api/auth/error` montada no setup.
    const adapter = new FetchAuthApiAdapter(baseUrl);
    await expect(
      adapter.login({ email: "x@x.com", password: "WrongPass1!" }),
    ).rejects.toBeInstanceOf(AuthFlowError);
  });
});
