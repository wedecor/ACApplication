import 'server-only';

/**
 * Headers for website → API calls on public endpoints. The internal token
 * proves the request came through this proxy (which already rate-limits per
 * visitor), so the API trusts `x-client-ip` and skips its own per-IP limit.
 */
export function upstreamHeaders(clientIp: string): Record<string, string> {
  const token = process.env.PUBLIC_LEAD_API_TOKEN;
  return {
    'x-client-ip': clientIp,
    ...(token ? { 'x-internal-token': token } : {}),
  };
}
