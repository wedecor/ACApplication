import { apiBase } from '@/config/env';
import { secureStore, SecureKeys } from '@/lib/secure-store';

/**
 * Mobile API client.
 *
 * Wraps `fetch` with:
 *   - automatic `Authorization: Bearer <access>` injection
 *   - one-shot refresh-token retry on 401
 *   - a clean `ApiError` shape that screens can surface in toasts
 *
 * Auth tokens are stored in {@link secureStore}. Refresh flow is centralised
 * here so screens never juggle token state themselves.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isAuth(): boolean {
    return this.status === 401 || this.status === 403;
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Skip Authorization header injection (used for /auth/* and /public/*). */
  skipAuth?: boolean;
  /** Skip the refresh-on-401 dance (used by the refresh call itself). */
  skipRefresh?: boolean;
  /** Stringify undefined values as omitted query keys. */
  raw?: boolean;
}

type Listener = () => void;

const onAuthLostListeners = new Set<Listener>();

export function onAuthLost(listener: Listener): () => void {
  onAuthLostListeners.add(listener);
  return () => onAuthLostListeners.delete(listener);
}

function broadcastAuthLost(): void {
  for (const l of onAuthLostListeners) {
    try {
      l();
    } catch {
      /* ignore */
    }
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = await secureStore.getItem(SecureKeys.RefreshToken);
  if (!refresh) return null;
  try {
    const res = await fetch(apiBase('/v1/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      accessToken?: string;
      refreshToken?: string;
    };
    if (!data.accessToken) return null;
    await secureStore.setItem(SecureKeys.AccessToken, data.accessToken);
    if (data.refreshToken) {
      await secureStore.setItem(SecureKeys.RefreshToken, data.refreshToken);
    }
    return data.accessToken;
  } catch {
    return null;
  }
}

let inflightRefresh: Promise<string | null> | null = null;
function getOrStartRefresh(): Promise<string | null> {
  if (!inflightRefresh) {
    inflightRefresh = refreshAccessToken().finally(() => {
      inflightRefresh = null;
    });
  }
  return inflightRefresh;
}

function buildQuery(query: RequestOptions['query']): string {
  if (!query) return '';
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? 'GET';
  const url = apiBase(path) + buildQuery(opts.query);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...opts.headers,
  };
  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    if (opts.body instanceof FormData) {
      body = opts.body;
    } else {
      headers['Content-Type'] ??= 'application/json';
      body = JSON.stringify(opts.body);
    }
  }

  if (!opts.skipAuth) {
    const access = await secureStore.getItem(SecureKeys.AccessToken);
    if (access) headers['Authorization'] = `Bearer ${access}`;
  }

  let response: Response;
  try {
    response = await fetch(url, { method, headers, body, signal: opts.signal });
  } catch (err) {
    throw new ApiError(0, null, err instanceof Error ? err.message : 'Network error');
  }

  if (response.status === 401 && !opts.skipAuth && !opts.skipRefresh) {
    const refreshed = await getOrStartRefresh();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${refreshed}`;
      try {
        response = await fetch(url, { method, headers, body, signal: opts.signal });
      } catch (err) {
        throw new ApiError(0, null, err instanceof Error ? err.message : 'Network error');
      }
    } else {
      // Refresh failed: surface the auth loss so the shell can route to /login.
      broadcastAuthLost();
    }
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  const text = await response.text();
  const data = text ? safeJson(text) : null;
  if (!response.ok) {
    const message = extractMessage(data) ?? `Request failed (${response.status})`;
    throw new ApiError(response.status, data, message);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const rec = body as Record<string, unknown>;
  if (typeof rec.message === 'string') return rec.message;
  if (Array.isArray(rec.message)) return rec.message.join(', ');
  if (typeof rec.error === 'string') return rec.error;
  return null;
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiFetch<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiFetch<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiFetch<T>(path, { ...opts, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiFetch<T>(path, { ...opts, method: 'PATCH', body }),
  delete: <T = void>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiFetch<T>(path, { ...opts, method: 'DELETE' }),
};
