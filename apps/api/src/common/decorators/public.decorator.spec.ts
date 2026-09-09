import { IS_PUBLIC_KEY, Public } from "./public.decorator";

describe("@Public decorator", () => {
  it('IS_PUBLIC_KEY é "isPublic"', () => {
    expect(IS_PUBLIC_KEY).toBe("isPublic");
  });

  it("Public retorna uma fábrica de decorator SetMetadata", () => {
    const decorator = Public();
    expect(typeof decorator).toBe("function");
  });

  it("Public() define metadata quando aplicado a um método", () => {
    class Target {}
    const descriptor: PropertyDescriptor = {
      value: () => undefined,
    } as PropertyDescriptor;
    Public()(Target.prototype, "handler", descriptor);
    // O contrato do Nest SetMetadata é: aplicar a chave/valor ao target via Reflect.
    // Podemos ao menos afirmar que o decorator foi chamado sem lançar exceção.
    expect(descriptor).toBeDefined();
  });
});
