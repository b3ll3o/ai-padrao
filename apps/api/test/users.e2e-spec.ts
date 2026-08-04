import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common"; // eslint-disable-line @typescript-eslint/consistent-type-imports
import { ZodValidationPipe } from "nestjs-zod";
import { AppModule } from "../src/app.module";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import request from "supertest";
import { PrismaService } from "../src/infra/prisma/prisma.service";

describe("Users (e2e)", () => {
  let app: INestApplication;
  let accessToken: string;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    prisma = moduleRef.get(PrismaService);

    const email = `admin-${Date.now()}@example.com`;
    const res = await request(app.getHttpServer())
      .post("/api/auth/register")
      .send({ email, password: "StrongPass1!", name: "Admin" })
      .expect(201);
    accessToken = res.body.accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it("GET /api/users returns paginated list when authenticated", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.items).toBeDefined();
    expect(res.body.total).toBeGreaterThanOrEqual(0);
  });

  it("GET /api/users returns 401 without auth", async () => {
    await request(app.getHttpServer()).get("/api/users").expect(401);
  });
});
