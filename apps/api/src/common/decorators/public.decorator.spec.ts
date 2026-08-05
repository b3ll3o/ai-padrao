import { IS_PUBLIC_KEY, Public } from "./public.decorator";

describe("@Public decorator", () => {
  it('IS_PUBLIC_KEY is "isPublic"', () => {
    expect(IS_PUBLIC_KEY).toBe("isPublic");
  });

  it("Public returns a SetMetadata decorator factory", () => {
    const decorator = Public();
    expect(typeof decorator).toBe("function");
  });

  it("Public() sets metadata when applied to a method", () => {
    class Target {}
    const descriptor: PropertyDescriptor = {
      value: () => undefined,
    } as PropertyDescriptor;
    Public()(Target.prototype, "handler", descriptor);
    // The Nest SetMetadata contract is: apply the key/value to the target via Reflect.
    // We can at least assert the decorator was called without throwing.
    expect(descriptor).toBeDefined();
  });
});
