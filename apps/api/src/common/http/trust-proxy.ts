/**
 * Fastify `trustProxy` from the TRUST_PROXY env var. Trusting every proxy
 * (`true`) makes `req.ip` whatever the client puts in X-Forwarded-For, which
 * defeats per-IP rate limits — so only a hop count or explicit proxy list is
 * accepted. Defaults to the socket address.
 */
export function parseTrustProxy(raw: string | undefined): false | number | string {
  const value = (raw ?? '').trim();
  if (!value || value === 'false' || value === '0') return false;
  if (value === 'true') throw new Error('TRUST_PROXY=true is unsafe; set a hop count or a proxy IP/CIDR list');
  if (/^\d+$/.test(value)) return Number(value);
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .join(',');
}
