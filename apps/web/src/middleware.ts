import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register'];

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasRefresh = request.cookies.has('refresh_token');

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    if (hasRefresh) return NextResponse.redirect(new URL('/dashboard', request.url));
    return NextResponse.next();
  }

  if (!hasRefresh && !pathname.startsWith('/api/')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
