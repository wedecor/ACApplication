import { ApiClientError } from './client';

/**
 * Human-readable message for a failed API call. `ApiClientError.message` is
 * only `[CODE] HTTP 409`; the server's explanation lives in `details`.
 */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof ApiClientError) {
    const details = err.details as { message?: unknown } | undefined;
    const msg = details?.message;
    if (typeof msg === 'string' && msg) return msg;
    if (Array.isArray(msg) && msg.length) return msg.map(String).join(', ');
    return err.message || fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function isApiError(err: unknown, status: number, code?: string): boolean {
  return err instanceof ApiClientError && err.status === status && (!code || err.code === code);
}
