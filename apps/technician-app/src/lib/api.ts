import Constants from 'expo-constants';

import { clearAuthSession, getAuthToken, getRefreshToken, updateTokens } from './auth';

const API_URL =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  process.env.EXPO_PUBLIC_API_URL ??
  'http://localhost:4000';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, unknown>;
  /** Throw on auth error (default true). Set false for best-effort calls. */
  throwOnAuthError?: boolean;
  /** Bearer token to use instead of the stored session (sign-in bootstrap). */
  token?: string;
}

/**
 * Error thrown for any non-2xx response. `status` is the HTTP status code;
 * network failures / timeouts surface as plain `TypeError` / `AbortError`
 * (see `isNetworkError`).
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function apiStatus(err: unknown): number | null {
  if (err instanceof ApiError) return err.status;
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : null;
}

/** 404 → the endpoint (or the record) isn't there yet. */
export function isNotFound(err: unknown): boolean {
  return apiStatus(err) === 404;
}

/**
 * True when the request never got an HTTP answer (offline, DNS failure,
 * 8s timeout). Those writes are safe to queue + retry later.
 */
export function isNetworkError(err: unknown): boolean {
  if (apiStatus(err) != null) return false;
  if (err instanceof TypeError) return true;
  const name = (err as { name?: unknown } | null)?.name;
  return name === 'AbortError';
}

interface ErrorBody {
  message?: unknown;
  code?: unknown;
  error?: { message?: unknown; code?: unknown; details?: unknown };
}

function parseErrorBody(err: unknown): ErrorBody | null {
  if (!(err instanceof Error)) return null;
  try {
    const parsed = JSON.parse(err.message) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed) : null;
  } catch {
    return null;
  }
}

/** Machine-readable error code, e.g. `CHECKLIST_INCOMPLETE`, `AMOUNT_EXCEEDS_DUE`. */
export function apiErrorCode(err: unknown): string | null {
  const body = parseErrorBody(err);
  const code = body?.error?.code ?? body?.code;
  return typeof code === 'string' ? code : null;
}

/** `error.details` from the global exception filter (the original exception body). */
export function apiErrorDetails(err: unknown): Record<string, unknown> | null {
  const details = parseErrorBody(err)?.error?.details;
  return details && typeof details === 'object' ? (details as Record<string, unknown>) : null;
}

/** Pull a human message out of a NestJS error body (`{ message }`) if present. */
export function apiErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return 'Something went wrong';
  try {
    const parsed = JSON.parse(err.message) as { message?: unknown; error?: { message?: unknown } };
    const msg = parsed.error?.message ?? parsed.message;
    if (Array.isArray(msg)) return msg.map(String).join('\n');
    if (typeof msg === 'string') return msg;
  } catch {
    // not JSON — fall through
  }
  return err.message;
}

/**
 * Tiny, dependency-free API client tuned for the field app:
 *   - 8s timeout (technicians work on low-bandwidth links),
 *   - auto-bearer injection,
 *   - typed return values (no JSON.parse boilerplate in callers),
 *   - resilient to "not connected" — the offline queue handles retries.
 */
function serialiseQueryValue(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return v.toString();
  return JSON.stringify(v);
}

let refreshing: Promise<string | null> | null = null;

/**
 * Exchange the stored refresh token for a new pair. Concurrent 401s share one
 * refresh; a rejected refresh clears the session so the app returns to sign-in.
 */
function refreshAccessToken(): Promise<string | null> {
  refreshing ??= (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return null;
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        if (res.status === 401) await clearAuthSession();
        return null;
      }
      const json = (await res.json()) as { data: { accessToken: string; refreshToken: string } };
      await updateTokens(json.data.accessToken, json.data.refreshToken);
      return json.data.accessToken;
    } catch {
      return null;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const url = new URL(`${API_URL}/api/v1${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v == null || v === '') continue;
    url.searchParams.set(k, serialiseQueryValue(v));
  }

  const send = async (token: string | null): Promise<Response> => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8_000);
    try {
      return await fetch(url.toString(), {
        method: opts.method ?? 'GET',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(opts.body ? { 'content-type': 'application/json' } : {}),
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: ac.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  const token = opts.token ?? (await getAuthToken());
  let res = await send(token);
  if (res.status === 401 && token && !opts.token) {
    const fresh = await refreshAccessToken();
    if (fresh) res = await send(fresh);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(text || `HTTP ${res.status}`, res.status);
  }
  const json = (await res.json()) as { data: T };
  return json.data;
}

export { API_URL };
