/** Nome do cookie de presença (sem o token) — lido pelo middleware Next.js. */
export const AUTH_COOKIE = "twin_auth";

export const TOKEN_KEY = "twin_token";
export const ORG_KEY = "twin_organization_id";

/** Rotas acessíveis sem sessão (espelhadas no middleware e no RouteGuard). */
export const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/onboarding",
] as const;

export function isPublicPath(pathname: string): boolean {
  return (PUBLIC_PATHS as readonly string[]).includes(pathname);
}
