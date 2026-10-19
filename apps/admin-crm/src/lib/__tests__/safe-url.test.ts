import { describe, expect, it } from 'vitest';

import { safeHttpUrl } from '../safe-url';

describe('safeHttpUrl', () => {
  it('passes http(s) links', () => {
    expect(safeHttpUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
  });

  it('drops script and malformed links', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,hi', '/relative', 42, null]) {
      expect(safeHttpUrl(bad)).toBeNull();
    }
  });
});
