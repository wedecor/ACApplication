import type { ApiError, ApiResponse } from '@ac/types';

import { env } from '@/env';
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from './auth-token';

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
      params.set(k, (v as unknown[]).map((x) => String(x)).join(','));
    } else if (typeof v === 'object') {
      params.set(k, JSON.stringify(v));
    } else {
      params.set(k, String(v));
    }
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const base = `${env.NEXT_PUBLIC_API_URL}/api/v1`;
        const res = await fetch(`${base}/auth/refresh`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ refreshToken: refresh }),
          credentials: 'include',
        });
        const json = (await res.json().catch(() => null)) as ApiResponse<{
          accessToken: string;
          refreshToken: string;
          permissionVersion: number;
        }> | null;
        if (!json?.success) return null;
        setAccessToken(json.data.accessToken);
        setRefreshToken(json.data.refreshToken);
        const { setStoredPermissionVersion } = await import('@/lib/rbac/permissions');
        setStoredPermissionVersion(json.data.permissionVersion);
        return json.data.accessToken;
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
      'content-type': 'application/json',
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
    const err = json as ApiError;
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
