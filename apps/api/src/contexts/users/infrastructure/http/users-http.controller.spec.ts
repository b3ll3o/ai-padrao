import { NotFoundException } from "@nestjs/common";
import { UsersHttpController } from "./users-http.controller";
import { FindUserUseCase } from "../../application/use-cases/find-user.use-case";
import { ListUsersUseCase } from "../../application/use-cases/list-users.use-case";
import { RemoveUserUseCase } from "../../application/use-cases/remove-user.use-case";
import { UpdateUserUseCase } from "../../application/use-cases/update-user.use-case";
import { InMemoryUserRepository } from "../../application/testing/in-memory-user.repository";
import { User } from "../../domain/entities/user";

const fixedDate = new Date("2026-01-01T00:00:00.000Z");

function seed(): User {
  return User.build({
    id: "u1",
    email: "alice@example.com",
    name: "Alice",
    role: "USER",
    createdAt: fixedDate,
    updatedAt: fixedDate,
  });
}

function buildController() {
  const repo = new InMemoryUserRepository([seed()]);
  return {
    repo,
    controller: new UsersHttpController(
      new ListUsersUseCase(repo),
      new FindUserUseCase(repo),
      new UpdateUserUseCase(repo),
      new RemoveUserUseCase(repo),
    ),
  };
}

describe("UsersHttpController", () => {
  describe("list", () => {
    it("returns paginated result", async () => {
      const { controller } = buildController();
      const result = await controller.list({ page: 1, pageSize: 10 });
      expect(result.total).toBe(1);
      expect(result.items[0]?.id).toBe("u1");
    });
  });

  describe("findOne", () => {
    it("returns the user dto when found", async () => {
      const { controller } = buildController();
      const result = await controller.findOne("u1");
      expect(result.id).toBe("u1");
      expect(result.email).toBe("alice@example.com");
    });

    it("throws NotFoundException when missing", async () => {
      const { controller } = buildController();
      await expect(controller.findOne("missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe("update", () => {
    it("returns the updated user dto", async () => {
      const { controller } = buildController();
      const result = await controller.update("u1", { name: "Alice Two" });
      expect(result.name).toBe("Alice Two");
    });

    it("throws NotFoundException when missing", async () => {
      const { controller } = buildController();
      await expect(
        controller.update("missing", { name: "Anything" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("remove", () => {
    it("resolves when user is deleted", async () => {
      const { controller } = buildController();
      await expect(controller.remove("u1", null)).resolves.toBeUndefined();
    });

    it("throws NotFoundException when missing", async () => {
      const { controller } = buildController();
      await expect(controller.remove("missing", null)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
