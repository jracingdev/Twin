import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, isPublicPath } from "@/lib/auth-constants";

/**
 * Proteção server-side das rotas autenticadas.
 * Verifica o cookie de presença `twin_auth` (setado no login via auth.ts).
 * O token Bearer permanece em sessionStorage; o RouteGuard valida a sessão via /me.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const hasAuth = request.cookies.get(AUTH_COOKIE)?.value === "1";
  if (!hasAuth) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
