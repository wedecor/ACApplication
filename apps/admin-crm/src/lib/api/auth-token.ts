/**
 * Access-token storage for the admin CRM. The short-lived access token lives
 * in sessionStorage (per tab) so the API client can attach Bearer auth across
 * reloads. The long-lived refresh token is never visible to scripts: the API
 * keeps it in an httpOnly cookie (see `x-session-transport: cookie`).
 */
const ACCESS_KEY = 'ac:access-token';
/** Pre-cookie builds stored the refresh token here; cleared on first run. */
const LEGACY_REFRESH_KEY = 'ac:refresh-token';

let accessInMemory: string | null = null;

export function setAccessToken(token: string | null): void {
  accessInMemory = token;
  if (typeof window === 'undefined') return;
  if (token) sessionStorage.setItem(ACCESS_KEY, token);
  else sessionStorage.removeItem(ACCESS_KEY);
}

export function getAccessToken(): string | null {
  if (accessInMemory) return accessInMemory;
  if (typeof window === 'undefined') return null;
  sessionStorage.removeItem(LEGACY_REFRESH_KEY);
  accessInMemory = sessionStorage.getItem(ACCESS_KEY);
  return accessInMemory;
}

export function clearAuthTokens(): void {
  setAccessToken(null);
  if (typeof window !== 'undefined') sessionStorage.removeItem(LEGACY_REFRESH_KEY);
}
