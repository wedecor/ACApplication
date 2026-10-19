/**
 * Post-login destination from `?next=`. Only same-origin paths are allowed:
 * `//evil.com` and `/\evil.com` are protocol-relative URLs to other sites.
 */
export function safeNextPath(next: string | null | undefined, fallback = '/leads'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  try {
    const url = new URL(next, 'https://admin.invalid');
    return url.origin === 'https://admin.invalid' ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
