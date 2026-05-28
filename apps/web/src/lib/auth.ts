const TOKEN_KEY = "twin_token";
const ORG_KEY = "twin_organization_id";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  clearOrganizationId();
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

export function getOrganizationId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ORG_KEY);
}

export function setOrganizationId(id: string): void {
  localStorage.setItem(ORG_KEY, id);
}

export function clearOrganizationId(): void {
  localStorage.removeItem(ORG_KEY);
}
