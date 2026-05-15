import { describe, expect, it } from 'vitest';

import { STATUS_COLOR } from '../status-colors';

describe('STATUS_COLOR palette', () => {
  it('defines a colour for every technician status used by the live map', () => {
    const required = [
      'OFFLINE',
      'ONLINE',
      'AVAILABLE',
      'BUSY',
      'ON_BREAK',
      'EN_ROUTE',
      'WORKING',
      'UNREACHABLE',
    ] as const;
    for (const s of required) {
      expect(STATUS_COLOR[s]).toBeDefined();
      expect(STATUS_COLOR[s].fg).toMatch(/^#/);
      expect(STATUS_COLOR[s].bg).toMatch(/^#/);
      expect(STATUS_COLOR[s].label.length).toBeGreaterThan(0);
    }
  });

  it('uses distinct foreground colours per status (visual disambiguation)', () => {
    const fgs = Object.values(STATUS_COLOR).map((c) => c.fg);
    expect(new Set(fgs).size).toBe(fgs.length);
  });
});
