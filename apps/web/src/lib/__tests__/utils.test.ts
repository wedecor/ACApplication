import { describe, expect, it } from 'vitest';

import { cn, formatNumber, formatRupees, humanizeSlug, isoDate, substituteKeyword } from '@/lib/utils';

describe('cn', () => {
  it('joins truthy class names', () => {
    expect(cn('a', undefined, false, 'b')).toBe('a b');
  });
});

describe('formatNumber', () => {
  it('uses en-IN grouping', () => {
    expect(formatNumber(120000)).toMatch(/1,20,000/);
  });
});

describe('formatRupees', () => {
  it('prefixes with ₹', () => {
    expect(formatRupees(199)).toBe('₹199');
  });
});

describe('substituteKeyword', () => {
  it('replaces {{keyword}} with sanitised input', () => {
    expect(substituteKeyword('{{keyword}} now', 'AC Repair', 'fallback')).toBe('AC Repair now');
  });

  it('falls back when keyword is missing or unsafe', () => {
    expect(substituteKeyword('{{keyword}}', null, 'AC Repair')).toBe('AC Repair');
    expect(substituteKeyword('{{keyword}}', '<script>', 'safe')).toBe('safe');
  });
});

describe('humanizeSlug', () => {
  it('Title-cases slugs', () => {
    expect(humanizeSlug('ac-repair')).toBe('AC Repair');
    expect(humanizeSlug('washing-machine-repair')).toBe('Washing Machine Repair');
  });
});

describe('isoDate', () => {
  it('returns YYYY-MM-DD', () => {
    expect(isoDate('2025-04-12T10:30:00Z')).toBe('2025-04-12');
  });
});
