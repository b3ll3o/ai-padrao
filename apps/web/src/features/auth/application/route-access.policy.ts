export interface RouteAccessRequest {
  pathname: string;
  hasRefreshToken: boolean;
}

export type RouteAccessDecision =
  { type: "allow" } | { type: "redirect"; to: string };

/** Routes reachable without a session. Subpaths count as public too. */
export const PUBLIC_PATHS = ["/login", "/register"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Pure routing policy for the auth guard. Framework-neutral so it can be unit
 * tested without Next.js; the middleware translates the decision into a
 * `NextResponse`.
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

  // API routes answer with their own 401 rather than a redirect.
  if (!hasRefreshToken && !pathname.startsWith("/api/")) {
    return { type: "redirect", to: "/login" };
  }

  return { type: "allow" };
}
