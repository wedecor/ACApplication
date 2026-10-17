import type { PresignResponse } from './repair-types';

/**
 * `POST /bookings/:id/attachments` requires a `storageKey`. Use the key the
 * presign endpoint echoes when it does; otherwise derive it from the public
 * URL's path (`https://cdn.example.com/<key>` → `<key>`).
 */
export function storageKeyFromPresign(p: Pick<PresignResponse, 'publicUrl' | 'key' | 'storageKey'>): string {
  if (p.key) return p.key;
  if (p.storageKey) return p.storageKey;
  const withoutQuery = p.publicUrl.split('?')[0] ?? p.publicUrl;
  const path = withoutQuery.replace(/^[a-z]+:\/\/[^/]+\/?/i, '');
  try {
    return decodeURIComponent(path) || p.publicUrl;
  } catch {
    return path || p.publicUrl;
  }
}
