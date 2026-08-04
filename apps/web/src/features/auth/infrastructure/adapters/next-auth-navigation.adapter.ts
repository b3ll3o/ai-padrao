import { redirect } from "next/navigation";
import type { AuthNavigationPort } from "../../domain/ports/auth-navigation.port";

/**
 * Owns `next/navigation`. `redirect()` throws, satisfying the `never` contract.
 *
 * The destinations are written as inline literals because `typedRoutes` only
 * accepts statically analysable route expressions.
 */
export class NextAuthNavigationAdapter implements AuthNavigationPort {
  dashboard(): never {
    redirect("/dashboard");
  }

  login(error?: string): never {
    if (error) redirect(`/login?error=${encodeURIComponent(error)}`);
    redirect("/login");
  }

  register(error?: string): never {
    if (error) redirect(`/register?error=${encodeURIComponent(error)}`);
    redirect("/register");
  }
}
