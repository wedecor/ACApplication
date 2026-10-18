import { describe, expect, it } from 'vitest';

import { formatJobWhen, formatPhone, humanizeStatus } from '../format';

describe('humanizeStatus', () => {
  it('sentence-cases enum values', () => {
    expect(humanizeStatus('IN_PROGRESS')).toBe('In progress');
    expect(humanizeStatus('ACKNOWLEDGED')).toBe('Acknowledged');
  });

  it('uses field wording for en-route and parts states', () => {
    expect(humanizeStatus('TECHNICIAN_EN_ROUTE')).toBe('On the way');
    expect(humanizeStatus('WAITING_PARTS')).toBe('Waiting for parts');
  });
});

describe('formatJobWhen', () => {
  it('prefers the booked slot over the exact time', () => {
    expect(formatJobWhen('2026-10-12T09:30:00.000Z', '14:00-16:00')).toMatch(/12 Oct · 14:00–16:00$/);
  });

  it('falls back to the slot when the date is invalid', () => {
    expect(formatJobWhen('not-a-date', '10:00-12:00')).toBe('10:00-12:00');
  });
});

describe('formatPhone', () => {
  it('groups Indian mobiles', () => {
    expect(formatPhone('+919000001028')).toBe('+91 90000 01028');
  });

  it('leaves other numbers alone', () => {
    expect(formatPhone('+14155550100')).toBe('+14155550100');
  });
});
