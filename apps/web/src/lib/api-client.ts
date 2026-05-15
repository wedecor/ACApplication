import type { ApiError, ApiResponse } from '@ac/types';

import { env } from '@/env';

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
  /** Override the base URL (defaults to NEXT_PUBLIC_API_URL). */
  baseUrl?: string;
}

/**
 * Tiny fetch wrapper that:
 *   - prefixes with `${env.NEXT_PUBLIC_API_URL}/api/v1`,
 *   - serializes/deserializes JSON,
 *   - unwraps the `ApiResponse` envelope,
 *   - throws `ApiClientError` with the canonical error code on failure.
 */
export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const base = opts.baseUrl ?? `${env.NEXT_PUBLIC_API_URL}/api/v1`;
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      ...opts.headers,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'include',
  });

  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!json) {
    throw new ApiClientError(res.status, 'INTERNAL', undefined);
  }
  if (!json.success) {
    const err = json as ApiError;
    throw new ApiClientError(
      err.error.statusCode,
      err.error.code,
      err.error.details,
      err.requestId,
    );
  }
  return json.data;
}
