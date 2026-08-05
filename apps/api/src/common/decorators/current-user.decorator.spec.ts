import "reflect-metadata";
import type { ExecutionContext } from "@nestjs/common";
import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants";
import { CurrentUser } from "./current-user.decorator";

describe("@CurrentUser decorator", () => {
  type FactoryArg = {
    data: unknown;
    factory: (data: unknown, ctx: ExecutionContext) => unknown;
  };
  const ROUTE_ARGS = ROUTE_ARGS_METADATA;

  const getFactory = (
    target: object,
    key: string,
    index: number,
  ): FactoryArg | null => {
    const args = Reflect.getMetadata(ROUTE_ARGS, target.constructor, key) as
      Record<string, Partial<FactoryArg>> | undefined;
    if (!args) return null;
    const values = Object.values(args);
    for (const v of values) {
      if (
        typeof v?.factory === "function" &&
        Number.isInteger((v as { index?: number }).index)
      ) {
        if ((v as { index: number }).index === index) return v as FactoryArg;
      }
      if (
        typeof v?.factory === "function" &&
        (v as { index?: number }).index === undefined
      ) {
        return v as FactoryArg;
      }
    }
    return null;
  };

  it("returns a ParameterDecorator when invoked without args", () => {
    const decorator = CurrentUser();
    expect(typeof decorator).toBe("function");
    expect(decorator.length).toBe(3);
  });

  it("registers a factory in ROUTE_ARGS_METADATA", () => {
    class C {
      handler(_u: unknown): void {
        void _u;
      }
    }
    CurrentUser()(C.prototype, "handler", 0);
    const meta = getFactory(C.prototype, "handler", 0);
    expect(meta).not.toBeNull();
    expect(typeof meta?.factory).toBe("function");
  });

  it("factory returns the request user via http ctx", () => {
    const user = { id: "u1", email: "a@a.com" };
    class C {
      handler(_u: unknown): void {
        void _u;
      }
    }
    CurrentUser()(C.prototype, "handler", 0);
    const meta = getFactory(C.prototype, "handler", 0);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
        getResponse: () => ({}),
        getNext: () => undefined,
      }),
    } as unknown as ExecutionContext;
    expect(meta?.factory(undefined, ctx)).toBe(user);
  });

  it("factory returns undefined when the request has no user", () => {
    class C {
      handler(_u: unknown): void {
        void _u;
      }
    }
    CurrentUser()(C.prototype, "handler", 0);
    const meta = getFactory(C.prototype, "handler", 0);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({}),
        getResponse: () => ({}),
        getNext: () => undefined,
      }),
    } as unknown as ExecutionContext;
    expect(meta?.factory(undefined, ctx)).toBeUndefined();
  });

  it("passes data arg through to the factory", () => {
    class C {
      handler(_u: unknown): void {
        void _u;
      }
    }
    CurrentUser("meta")(C.prototype, "handler", 0);
    const meta = getFactory(C.prototype, "handler", 0);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: "x" } }),
        getResponse: () => ({}),
        getNext: () => undefined,
      }),
    } as unknown as ExecutionContext;
    const result = meta?.factory("arg", ctx) as { id: string };
    expect(result.id).toBe("x");
  });
});
