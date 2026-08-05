import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { UsersHttpController } from "./users-http.controller";
import { FindUserUseCase } from "../../application/use-cases/find-user.use-case";
import { GetUserHistoryUseCase } from "../../application/use-cases/get-user-history.use-case";
import { ListUsersUseCase } from "../../application/use-cases/list-users.use-case";
import { RemoveUserUseCase } from "../../application/use-cases/remove-user.use-case";
import { RestoreUserUseCase } from "../../application/use-cases/restore-user.use-case";
import { UpdateUserUseCase } from "../../application/use-cases/update-user.use-case";
import { InMemoryUserRepository } from "../../application/testing/in-memory-user.repository";
import { User } from "../../domain/entities/user";
import type { AuthenticatedActor } from "./users-http.controller";
import { UserNotDeletedError } from "../../domain/errors/user-not-deleted.error";

const fixedDate = new Date("2026-01-01T00:00:00.000Z");

const adminActor: AuthenticatedActor = { id: "admin-1", role: "ADMIN" };
const userActor: AuthenticatedActor = { id: "u-actor", role: "USER" };

function seed(): User {
  return User.build({
    id: "u1",
    email: "alice@example.com",
    name: "Alice",
    role: "USER",
    createdAt: fixedDate,
    updatedAt: fixedDate,
    deletedAt: null,
    version: 0,
  });
}

function buildController(seedUser: User = seed()) {
  const repo = new InMemoryUserRepository([seedUser]);
  return {
    repo,
    controller: new UsersHttpController(
      new ListUsersUseCase(repo),
      new FindUserUseCase(repo),
      new UpdateUserUseCase(repo),
      new RemoveUserUseCase(repo),
      new RestoreUserUseCase(repo),
      new GetUserHistoryUseCase(repo),
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
    it("returns the updated user dto (no actor required)", async () => {
      const { controller } = buildController();
      const result = await controller.update(
        "u1",
        { name: "Alice Two" },
        userActor,
      );
      expect(result.name).toBe("Alice Two");
    });

    it("throws NotFoundException when missing", async () => {
      const { controller } = buildController();
      await expect(
        controller.update("missing", { name: "Anything" }, userActor),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("remove", () => {
    it("soft-deletes the user and resolves when admin", async () => {
      const { controller } = buildController();
      await expect(
        controller.remove("u1", adminActor),
      ).resolves.toBeUndefined();
    });

    it("throws NotFoundException when missing", async () => {
      const { controller } = buildController();
      await expect(
        controller.remove("missing", adminActor),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("restore", () => {
    it("returns the restored user dto when admin", async () => {
      const deletedUser = seed().markDeleted(new Date());
      const { controller, repo } = buildController(deletedUser);
      const result = await controller.restore("u1", adminActor);
      expect(result.deletedAt).toBeNull();
      expect(await repo.findByIdIncludingDeleted("u1")).toBeDefined();
    });

    it("throws BadRequestException when user is not deleted", async () => {
      const { controller } = buildController();
      await expect(controller.restore("u1", adminActor)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("throws UnauthorizedException when actor is missing", async () => {
      const { controller } = buildController();
      await expect(controller.restore("u1", undefined)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("throws ForbiddenException for non-admin actors", async () => {
      const deletedUser = seed().markDeleted(new Date());
      const { controller } = buildController(deletedUser);
      await expect(controller.restore("u1", userActor)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it("surfaces UserNotDeletedError as BadRequestException", async () => {
      const { controller, repo } = buildController();
      jest
         
        .spyOn(repo as any, "restore")
        .mockRejectedValueOnce(new UserNotDeletedError("u1"));
      await expect(controller.restore("u1", adminActor)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe("history", () => {
    it("returns the history entries when admin", async () => {
      const { repo } = buildController();
      await repo.softDelete("u1", adminActor.id);
      const { controller } = buildController();
      // rebuild with same repo so history is visible
      const entries = await controller.history("u1", adminActor);
      expect(Array.isArray(entries)).toBe(true);
    });

    it("throws ForbiddenException for non-admin actors", async () => {
      const { controller } = buildController();
      await expect(controller.history("u1", userActor)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it("throws UnauthorizedException when actor is missing", async () => {
      const { controller } = buildController();
      await expect(controller.history("u1", undefined)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
