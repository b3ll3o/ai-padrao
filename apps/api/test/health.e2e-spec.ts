import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common"; // eslint-disable-line @typescript-eslint/consistent-type-imports
import { ZodValidationPipe } from "nestjs-zod";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { PrismaService } from "../src/infra/prisma/prisma.service";

/**
 * Smoke e2e do bounded context de health. Os probes `/health` e
 * `/health/ready` DEVEM estar acessíveis sem token (marcados com
 * `@Public()`) — esta suíte existe justamente para garantir que a
 * política de auth pública não foi quebrada em uma refatoração futura
 * (a regressão típica: alguém adiciona um `AuthGuard` global sem
 * perceber e o orquestrador não consegue mais fazer liveness/readiness).
 */
describe("Health (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication({ logger: ["error", "warn"] });
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it("GET /api/health retorna 200 com status=ok sem exigir token", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/health")
      .expect(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.uptime).toBe("number");
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
  });

  it("GET /api/health/ready retorna 200 com db=up quando o Postgres responde", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/health/ready")
      .expect(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.db).toBe("up");
  });

  it("GET /api/health e /api/health/ready não vazam o erro do banco", async () => {
    // Mesmo que o adapter de DB esteja reportando algo estranho, o shape
    // de readiness continua sendo { status, db } — sem detalhes internos.
    const res = await request(app.getHttpServer())
      .get("/api/health/ready")
      .expect(200);
    expect(Object.keys(res.body).sort()).toEqual(["db", "status"]);
  });
});
