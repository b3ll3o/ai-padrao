import { redirect } from "next/navigation";
import type { AuthNavigationPort } from "../../domain/ports/auth-navigation.port";

/**
 * Dono de `next/navigation`. `redirect()` lança, satisfazendo o contrato
 * `never`.
 *
 * Os destinos são escritos como literais inline porque `typedRoutes` só aceita
 * expressões de rota analisáveis estaticamente.
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
