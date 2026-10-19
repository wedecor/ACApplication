import type { ApiResponse } from '@ac/types';

import { env } from '@/env';

import { clearAuthTokens, getAccessToken, setAccessToken } from './auth-token';

/** Tells the API to keep the refresh token in its httpOnly cookie, never in JS. */
export const COOKIE_TRANSPORT = { 'x-session-transport': 'cookie' } as const;

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
    public readonly requestId?: string,
  ) {
    super(`[${code}] HTTP ${status}`);
    this.name = 'ApiClientError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  query?: Record<string, unknown>;
  baseUrl?: string;
  /** Internal — skip refresh retry (prevents infinite loops). */
  _retry?: boolean;
}

function buildQuery(query?: RequestOptions['query']): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      params.set(k, (v as unknown[]).map((x) => (typeof x === 'object' ? JSON.stringify(x) : `${x as string | number | boolean}`)).join(','));
    } else if (typeof v === 'object') {
      params.set(k, JSON.stringify(v));
    } else {
      params.set(k, `${v as string | number | boolean | bigint}`);
    }
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshOnce(): Promise<{ accessToken: string; permissionVersion: number } | null> {
  const base = `${env.NEXT_PUBLIC_API_URL}/api/v1`;
  const res = await fetch(`${base}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...COOKIE_TRANSPORT },
    body: JSON.stringify({}),
    credentials: 'include',
  });
  const json = (await res.json().catch(() => null)) as ApiResponse<{
    accessToken: string;
    permissionVersion: number;
  }> | null;
  return json?.success ? json.data : null;
}

/** New access token from the refresh cookie, or null when the session is over. */
export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        // Another tab may have just rotated the cookie; one short retry covers that race.
        const data =
          (await refreshOnce()) ?? (await new Promise((r) => setTimeout(r, 400)).then(refreshOnce));
        if (!data) return null;
        setAccessToken(data.accessToken);
        const { setStoredPermissionVersion } = await import('@/lib/rbac/permissions');
        setStoredPermissionVersion(data.permissionVersion);
        return data.accessToken;
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  return refreshInFlight;
}

function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  clearAuthTokens();
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  if (!window.location.pathname.startsWith('/login')) {
    window.location.assign(`/login?next=${next}`);
  }
}

/**
 * Strongly-typed fetch wrapper that unwraps the API envelope. Handles auth
 * header injection, automatic refresh on 401, and redirects to login when
 * the session cannot be renewed.
 */
export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const base = opts.baseUrl ?? `${env.NEXT_PUBLIC_API_URL}/api/v1`;
  const token = getAccessToken();
  const res = await fetch(`${base}${path}${buildQuery(opts.query)}`, {
    ...opts,
    headers: {
      // Only declare JSON when sending a body — an empty JSON body is a 400.
      ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: 'include',
  });

  if (res.status === 204) return undefined as T;

  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!json) {
    throw new ApiClientError(res.status, 'INTERNAL', undefined);
  }

  if (!json.success) {
    const err = json;
    const isAuthPath = path.startsWith('/auth/');
    if (
      err.error.statusCode === 401 &&
      !opts._retry &&
      !isAuthPath &&
      typeof window !== 'undefined'
    ) {
      const shouldRefresh =
        err.error.code === 'PERMISSIONS_STALE' ||
        err.error.code === 'UNAUTHORIZED' ||
        err.error.code === 'TOKEN_EXPIRED';
      if (shouldRefresh) {
        const newToken = await refreshAccessToken();
        if (newToken) {
          return apiFetch<T>(path, { ...opts, _retry: true });
        }
      }
      redirectToLogin();
    }
    throw new ApiClientError(
      err.error.statusCode,
      err.error.code,
      err.error.details,
      err.requestId,
    );
  }

  return json.data;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
