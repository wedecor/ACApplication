/**
 * Access + refresh token storage for the admin CRM.
 * Tokens live in sessionStorage so the API client can attach Bearer auth.
 */
const ACCESS_KEY = 'ac:access-token';
const REFRESH_KEY = 'ac:refresh-token';

let accessInMemory: string | null = null;
let refreshInMemory: string | null = null;

export function setAccessToken(token: string | null): void {
  accessInMemory = token;
  if (typeof window === 'undefined') return;
  if (token) sessionStorage.setItem(ACCESS_KEY, token);
  else sessionStorage.removeItem(ACCESS_KEY);
}

export function getAccessToken(): string | null {
  if (accessInMemory) return accessInMemory;
  if (typeof window === 'undefined') return null;
  accessInMemory = sessionStorage.getItem(ACCESS_KEY);
  return accessInMemory;
}

export function setRefreshToken(token: string | null): void {
  refreshInMemory = token;
  if (typeof window === 'undefined') return;
  if (token) sessionStorage.setItem(REFRESH_KEY, token);
  else sessionStorage.removeItem(REFRESH_KEY);
}

export function getRefreshToken(): string | null {
  if (refreshInMemory) return refreshInMemory;
  if (typeof window === 'undefined') return null;
  refreshInMemory = sessionStorage.getItem(REFRESH_KEY);
  return refreshInMemory;
}

export function clearAuthTokens(): void {
  setAccessToken(null);
  setRefreshToken(null);
}
