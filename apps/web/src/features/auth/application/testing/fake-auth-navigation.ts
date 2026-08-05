import type { AuthNavigationPort } from "../../domain/ports/auth-navigation.port";

export interface RecordedNavigation {
  target: "dashboard" | "login" | "register";
  error?: string;
}

/**
 * Thrown by `FakeAuthNavigation` so the double honours the `never` contract of
 * `AuthNavigationPort` the same way Next.js `redirect()` does.
 */
export class NavigationSignal extends Error {
  constructor(readonly navigation: RecordedNavigation) {
    super(`__navigate:${navigation.target}`);
    this.name = "NavigationSignal";
  }
}

export class FakeAuthNavigation implements AuthNavigationPort {
  readonly calls: RecordedNavigation[] = [];

  get last(): RecordedNavigation | undefined {
    return this.calls[this.calls.length - 1];
  }

  dashboard(): never {
    return this.record({ target: "dashboard" });
  }

  login(error?: string): never {
    return this.record({ target: "login", error });
  }

  register(error?: string): never {
    return this.record({ target: "register", error });
  }

  private record(navigation: RecordedNavigation): never {
    this.calls.push(navigation);
    throw new NavigationSignal(navigation);
  }
}

/**
 * Runs a flow that is expected to end in navigation and returns what it
 * navigated to, so tests never have to hand-roll try/catch.
 */
export async function captureNavigation(
  run: () => Promise<unknown>,
): Promise<RecordedNavigation> {
  try {
    await run();
  } catch (error) {
    if (error instanceof NavigationSignal) return error.navigation;
    throw error;
  }
  throw new Error("Expected the flow to navigate, but it returned normally.");
}
