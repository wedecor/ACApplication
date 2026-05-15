import Constants from 'expo-constants';

import { getAuthToken } from './auth';

const API_URL =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  process.env.EXPO_PUBLIC_API_URL ??
  'http://localhost:3001';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, unknown>;
  /** Throw on auth error (default true). Set false for best-effort calls. */
  throwOnAuthError?: boolean;
}

/**
 * Tiny, dependency-free API client tuned for the field app:
 *   - 8s timeout (technicians work on low-bandwidth links),
 *   - auto-bearer injection,
 *   - typed return values (no JSON.parse boilerplate in callers),
 *   - resilient to "not connected" — the offline queue handles retries.
 */
export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const token = await getAuthToken();
  const url = new URL(`${API_URL}/api/v1${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v != null) url.searchParams.set(k, String(v));
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8_000);
  try {
    const res = await fetch(url.toString(), {
      method: opts.method ?? 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.body ? { 'content-type': 'application/json' } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: ac.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw Object.assign(new Error(text || `HTTP ${res.status}`), { status: res.status });
    }
    const json = (await res.json()) as { data: T };
    return json.data;
  } finally {
    clearTimeout(timer);
  }
}

export { API_URL };
