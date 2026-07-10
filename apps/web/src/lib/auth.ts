import {
  AUTH_COOKIE,
  ORG_KEY,
  TOKEN_KEY,
} from "@/lib/auth-constants";

export { AUTH_COOKIE, ORG_KEY, TOKEN_KEY, isPublicPath, PUBLIC_PATHS } from "@/lib/auth-constants";

/**
 * Auth web (Preferência B — pragmática):
 * - Token Bearer em `sessionStorage` (não persiste entre abas/dispositivos como localStorage).
 * - Cookie `twin_auth=1` com `SameSite=Lax` (+ `Secure` em HTTPS) só como sinal de presença
 *   para o middleware Next.js redirecionar rotas protegidas no servidor.
 * - Migração one-shot de `localStorage` legado para não quebrar sessões existentes.
 *
 * Sanctum SPA (cookie httpOnly) fica como evolução futura quando a API expuser
 * `SANCTUM_STATEFUL_DOMAINS` + CSRF de ponta a ponta.
 */

function canUseDom(): boolean {
  return typeof window !== "undefined";
}

function cookieSecureFlag(): string {
  return window.location.protocol === "https:" ? "; Secure" : "";
}

function setAuthCookie(): void {
  document.cookie = `${AUTH_COOKIE}=1; path=/; SameSite=Lax${cookieSecureFlag()}`;
}

function clearAuthCookie(): void {
  document.cookie = `${AUTH_COOKIE}=; path=/; Max-Age=0; SameSite=Lax${cookieSecureFlag()}`;
}

let migrated = false;

function migrateLegacyLocalStorage(): void {
  if (!canUseDom() || migrated) return;
  migrated = true;

  const legacyToken = localStorage.getItem(TOKEN_KEY);
  if (legacyToken && !sessionStorage.getItem(TOKEN_KEY)) {
    sessionStorage.setItem(TOKEN_KEY, legacyToken);
  }
  if (legacyToken || localStorage.getItem(TOKEN_KEY)) {
    localStorage.removeItem(TOKEN_KEY);
  }

  const legacyOrg = localStorage.getItem(ORG_KEY);
  if (legacyOrg && !sessionStorage.getItem(ORG_KEY)) {
    sessionStorage.setItem(ORG_KEY, legacyOrg);
  }
  if (legacyOrg || localStorage.getItem(ORG_KEY)) {
    localStorage.removeItem(ORG_KEY);
  }

  if (sessionStorage.getItem(TOKEN_KEY)) {
    setAuthCookie();
  }
}

export function getToken(): string | null {
  if (!canUseDom()) return null;
  migrateLegacyLocalStorage();
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
  localStorage.removeItem(TOKEN_KEY);
  setAuthCookie();
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  clearAuthCookie();
  clearOrganizationId();
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

export function getOrganizationId(): string | null {
  if (!canUseDom()) return null;
  migrateLegacyLocalStorage();
  return sessionStorage.getItem(ORG_KEY);
}

export function setOrganizationId(id: string): void {
  sessionStorage.setItem(ORG_KEY, id);
  localStorage.removeItem(ORG_KEY);
}

export function clearOrganizationId(): void {
  sessionStorage.removeItem(ORG_KEY);
  localStorage.removeItem(ORG_KEY);
}
