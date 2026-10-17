import { describe, expect, it } from 'vitest';

import { formatWhen } from '../format';

const NOW = new Date(2026, 9, 17, 15, 0);

describe('formatWhen', () => {
  it('shows only the time for today', () => {
    expect(formatWhen(new Date(2026, 9, 17, 9, 5), NOW)).not.toMatch(/Oct|Yesterday/);
  });

  it('labels yesterday and tomorrow', () => {
    expect(formatWhen(new Date(2026, 9, 16, 21, 0), NOW)).toMatch(/^Yesterday, /);
    expect(formatWhen(new Date(2026, 9, 18, 10, 0), NOW)).toMatch(/^Tomorrow, /);
  });

  it('omits the year within the current year and keeps it otherwise', () => {
    expect(formatWhen(new Date(2026, 4, 18, 10, 0), NOW)).toMatch(/^18 May, /);
    expect(formatWhen(new Date(2025, 4, 18, 10, 0), NOW)).toMatch(/2025/);
  });

  it('renders a dash for missing values', () => {
    expect(formatWhen(null, NOW)).toBe('—');
  });
});
