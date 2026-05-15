import { describe, expect, it } from 'vitest';

import { rateLimit } from '@/lib/rate-limit';

describe('rateLimit', () => {
  it('allows up to N requests in the window then blocks', () => {
    const key = `test-${Math.random()}`;
    const opts = { key, limit: 3, windowMs: 100 };
    expect(rateLimit(opts).ok).toBe(true);
    expect(rateLimit(opts).ok).toBe(true);
    expect(rateLimit(opts).ok).toBe(true);
    expect(rateLimit(opts).ok).toBe(false);
  });

  it('resets after the window expires', async () => {
    const key = `test-${Math.random()}`;
    rateLimit({ key, limit: 1, windowMs: 30 });
    expect(rateLimit({ key, limit: 1, windowMs: 30 }).ok).toBe(false);
    await new Promise((r) => setTimeout(r, 50));
    expect(rateLimit({ key, limit: 1, windowMs: 30 }).ok).toBe(true);
  });
});
