import { timingSafeEqual } from 'node:crypto';

interface HeaderBag {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
}

/** True when the request carries the website proxy's PUBLIC_LEAD_API_TOKEN. */
export function isTrustedProxyRequest(req: HeaderBag, token = process.env.PUBLIC_LEAD_API_TOKEN): boolean {
  const given = req.headers['x-internal-token'];
  if (!token || typeof given !== 'string') return false;
  const a = Buffer.from(token);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Visitor IP for attribution: the proxy-supplied `x-client-ip` only on trusted
 * proxy requests, otherwise the connection address (never client headers).
 */
export function clientIpOf(req: HeaderBag): string | null {
  const forwarded = req.headers['x-client-ip'];
  if (isTrustedProxyRequest(req) && typeof forwarded === 'string' && forwarded.length <= 64) return forwarded;
  return req.ip ?? null;
}
