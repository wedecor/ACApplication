import { describe, expect, it } from 'vitest';

import { safeNextPath } from '../safe-next';

describe('safeNextPath', () => {
  it('keeps same-origin paths with their query', () => {
    expect(safeNextPath('/bookings/b1?tab=notes')).toBe('/bookings/b1?tab=notes');
  });

  it('rejects other sites, including protocol-relative tricks', () => {
    for (const bad of ['//evil.com/login', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)', '']) {
      expect(safeNextPath(bad)).toBe('/leads');
    }
  });
});
