export interface RouteAccessRequest {
  pathname: string;
  hasRefreshToken: boolean;
}

export type RouteAccessDecision =
  { type: "allow" } | { type: "redirect"; to: string };

/** Rotas acessíveis sem sessão. Subpaths também contam como públicos. */
export const PUBLIC_PATHS = ["/login", "/register"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Política de roteamento pura para o auth guard. Framework-neutral para que
 * possa ser testada em unit sem Next.js; o middleware traduz a decisão em
 * um `NextResponse`.
 */
export function decideRouteAccess({
  pathname,
  hasRefreshToken,
}: RouteAccessRequest): RouteAccessDecision {
  if (isPublicPath(pathname)) {
    return hasRefreshToken
      ? { type: "redirect", to: "/dashboard" }
      : { type: "allow" };
  }

  // Rotas de API respondem com seu próprio 401 em vez de redirecionar.
  if (!hasRefreshToken && !pathname.startsWith("/api/")) {
    return { type: "redirect", to: "/login" };
  }

  return { type: "allow" };
}
