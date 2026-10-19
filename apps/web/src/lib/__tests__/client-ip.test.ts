import { describe, expect, it } from 'vitest';

import { getClientIp } from '../rate-limit';

const req = (headers: Record<string, string>) => new Request('http://x', { headers });

describe('getClientIp', () => {
  it('ignores client-supplied entries on the left of X-Forwarded-For', () => {
    expect(getClientIp(req({ 'x-forwarded-for': '1.2.3.4, 203.0.113.9' }), 1)).toBe('203.0.113.9');
  });

  it('honours the trusted hop count', () => {
    expect(getClientIp(req({ 'x-forwarded-for': 'spoof, 198.51.100.7, 10.0.0.2' }), 2)).toBe('198.51.100.7');
  });

  it('falls back to x-real-ip', () => {
    expect(getClientIp(req({ 'x-real-ip': '192.0.2.5' }), 1)).toBe('192.0.2.5');
  });
});
