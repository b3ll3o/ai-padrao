import { NextResponse, type NextRequest } from "next/server";
import { decideRouteAccess } from "@/features/auth/application/route-access.policy";
import { REFRESH_COOKIE } from "@/features/auth/infrastructure/adapters/auth-cookie.config";

/**
 * Composition root para o auth guard: lê a request, delega a decisão à
 * política framework-neutral e a traduz em uma response.
 */
export function middleware(request: NextRequest): NextResponse {
  const decision = decideRouteAccess({
    pathname: request.nextUrl.pathname,
    hasRefreshToken: request.cookies.has(REFRESH_COOKIE),
  });

  if (decision.type === "redirect") {
    return NextResponse.redirect(new URL(decision.to, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
