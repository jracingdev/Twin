export const CONSENT_VERSION = "1.0.0";
export const CONSENT_STORAGE_KEY = "twin_consent_id";

export function getStoredConsentId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(CONSENT_STORAGE_KEY);
}

export function setStoredConsentId(id: number | string): void {
  sessionStorage.setItem(CONSENT_STORAGE_KEY, String(id));
}

export function clearStoredConsentId(): void {
  sessionStorage.removeItem(CONSENT_STORAGE_KEY);
}
