import type { Reflector } from "@nestjs/core";
import type { ExecutionContext } from "@nestjs/common";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

describe("JwtAuthGuard", () => {
  const buildContext = (handler: unknown, cls: unknown) =>
    ({
      getHandler: () => handler,
      getClass: () => cls,
    }) as unknown as ExecutionContext;

  it("returns true when IS_PUBLIC_KEY is set on the handler", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);
    const ctx = buildContext("handler", "cls");
    expect(guard.canActivate(ctx)).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      "handler",
      "cls",
    ]);
  });

  it('falls through to AuthGuard("jwt").canActivate when no public metadata', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const parent = jest
      .spyOn(
        Object.getPrototypeOf(JwtAuthGuard.prototype),
        "canActivate" as never,
      )
      .mockReturnValue(true as never);
    const guard = new JwtAuthGuard(reflector);
    const ctx = buildContext("h", "c");
    expect(guard.canActivate(ctx)).toBe(true);
    expect(parent).toHaveBeenCalledWith(ctx);
    parent.mockRestore();
  });

  it("returns whatever the parent passport guard returns when not public", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const parent = jest
      .spyOn(
        Object.getPrototypeOf(JwtAuthGuard.prototype),
        "canActivate" as never,
      )
      .mockReturnValue(false as never);
    const guard = new JwtAuthGuard(reflector);
    const ctx = buildContext("h", "c");
    expect(guard.canActivate(ctx)).toBe(false);
    parent.mockRestore();
  });
});
