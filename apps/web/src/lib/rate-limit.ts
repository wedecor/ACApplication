/**
 * Naïve in-memory rate limiter for the Next.js API routes.
 *
 * This is a *belt-and-braces* defence — the canonical rate limit lives
 * on the NestJS backend (Redis-backed `@nestjs/throttler`). The Next
 * route handlers add a cheaper, first-line filter so we don't even
 * forward obvious abuse to the API.
 *
 * Limitations:
 *  - In-memory only → resets on each cold start.
 *  - Single-process → fine for a small marketing footprint; if we go
 *    multi-process behind Vercel functions, replace with an Upstash /
 *    Redis-backed limiter.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface LimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(opts: {
  key: string;
  /** Max requests in `windowMs`. */
  limit: number;
  /** Window size in ms. */
  windowMs: number;
}): LimitResult {
  const now = Date.now();
  const existing = buckets.get(opts.key);
  if (!existing || existing.resetAt < now) {
    const fresh: Bucket = { count: 1, resetAt: now + opts.windowMs };
    buckets.set(opts.key, fresh);
    return { ok: true, remaining: opts.limit - 1, resetAt: fresh.resetAt };
  }
  existing.count += 1;
  if (existing.count > opts.limit) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt };
  }
  return {
    ok: true,
    remaining: opts.limit - existing.count,
    resetAt: existing.resetAt,
  };
}

/** Periodically purge expired buckets to avoid unbounded growth. */
if (typeof globalThis !== 'undefined') {
  // Only schedule once per Node process.
  const g = globalThis as unknown as { __rateLimitInterval?: NodeJS.Timeout };
  if (!g.__rateLimitInterval) {
    g.__rateLimitInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt < now) buckets.delete(key);
      }
    }, 60_000).unref?.();
  }
}

/**
 * Client IP for rate limiting. The left end of X-Forwarded-For is whatever the
 * client sent, so we read from the right: each trusted proxy in front of this
 * app (TRUSTED_PROXY_HOPS, default 1) appends the address it received from.
 */
export function getClientIp(req: Request, hops = Number(process.env['TRUSTED_PROXY_HOPS'] ?? 1)): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd && hops > 0) {
    const parts = fwd.split(',').map((p) => p.trim()).filter(Boolean);
    const ip = parts[parts.length - hops] ?? parts[0];
    if (ip) return ip;
  }
  return req.headers.get('x-real-ip') ?? 'unknown';
}
