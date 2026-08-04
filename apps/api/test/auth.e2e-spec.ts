import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common"; // eslint-disable-line @typescript-eslint/consistent-type-imports
import { ZodValidationPipe } from "nestjs-zod";
import { AppModule } from "../src/app.module";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import request from "supertest";
import { PrismaService } from "../src/infra/prisma/prisma.service";

describe("Auth (e2e)", () => {
  let app: INestApplication;
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
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  const uniqueEmail = () =>
    `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

  it("POST /api/auth/register creates a user and returns tokens", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/register")
      .send({ email: uniqueEmail(), password: "StrongPass1!", name: "Test" })
      .expect(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toContain("@example.com");
  });

  it("POST /api/auth/login returns tokens for valid credentials", async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post("/api/auth/register")
      .send({ email, password: "StrongPass1!", name: "Test" })
      .expect(201);
    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email, password: "StrongPass1!" })
      .expect(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it("POST /api/auth/login fails with wrong password", async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post("/api/auth/register")
      .send({ email, password: "StrongPass1!", name: "Test" })
      .expect(201);
    await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email, password: "WrongPass1!" })
      .expect(401);
  });

  it("POST /api/auth/refresh rotates a valid refresh token", async () => {
    const email = uniqueEmail();
    const reg = await request(app.getHttpServer())
      .post("/api/auth/register")
      .send({ email, password: "StrongPass1!", name: "Test" })
      .expect(201);

    const firstRefresh = reg.body.refreshToken as string;

    const rotated = await request(app.getHttpServer())
      .post("/api/auth/refresh")
      .send({ refreshToken: firstRefresh })
      .expect(200);

    expect(rotated.body.accessToken).toBeDefined();
    expect(rotated.body.refreshToken).toBeDefined();
    expect(rotated.body.refreshToken).not.toBe(firstRefresh);
  });

  it("POST /api/auth/refresh rejects the rotated token (single-use)", async () => {
    const email = uniqueEmail();
    const reg = await request(app.getHttpServer())
      .post("/api/auth/register")
      .send({ email, password: "StrongPass1!", name: "Test" })
      .expect(201);

    const firstRefresh = reg.body.refreshToken as string;

    await request(app.getHttpServer())
      .post("/api/auth/refresh")
      .send({ refreshToken: firstRefresh })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/auth/refresh")
      .send({ refreshToken: firstRefresh })
      .expect(401);
  });

  it("POST /api/auth/logout invalidates the refresh token", async () => {
    const email = uniqueEmail();
    const reg = await request(app.getHttpServer())
      .post("/api/auth/register")
      .send({ email, password: "StrongPass1!", name: "Test" })
      .expect(201);

    const refreshToken = reg.body.refreshToken as string;

    await request(app.getHttpServer())
      .post("/api/auth/logout")
      .send({ refreshToken })
      .expect(204);

    await request(app.getHttpServer())
      .post("/api/auth/refresh")
      .send({ refreshToken })
      .expect(401);
  });
});
