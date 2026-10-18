import { describe, expect, it } from 'vitest';

import { formatMinorINR, quotationStage } from '../quotation';

describe('formatMinorINR', () => {
  it('formats whole rupees without paise', () => {
    expect(formatMinorINR(118_000)).toBe('₹1,180');
  });

  it('keeps real paise and lakh grouping', () => {
    expect(formatMinorINR(12_345_650)).toBe('₹1,23,456.50');
  });
});

describe('quotationStage', () => {
  const future = '2099-01-01T00:00:00.000Z';
  const past = '2000-01-01T00:00:00.000Z';

  it('lets the customer decide on a sent or viewed quote', () => {
    expect(quotationStage({ status: 'SENT', expiresAt: future })).toBe('awaiting');
    expect(quotationStage({ status: 'VIEWED', expiresAt: future })).toBe('awaiting');
  });

  it('treats a lapsed deadline as expired before the nightly sweep runs', () => {
    expect(quotationStage({ status: 'VIEWED', expiresAt: past })).toBe('expired');
  });

  it('reports settled quotes', () => {
    expect(quotationStage({ status: 'CONVERTED', expiresAt: past })).toBe('approved');
    expect(quotationStage({ status: 'REJECTED', expiresAt: future })).toBe('declined');
  });
});

describe('isTaskPage', () => {
  it('flags quotation and rating pages only', async () => {
    const { isTaskPage } = await import('../routes');
    expect(isTaskPage('/quotations/abc')).toBe(true);
    expect(isTaskPage('/rate/abc.def')).toBe(true);
    expect(isTaskPage('/book')).toBe(false);
    expect(isTaskPage(null)).toBe(false);
  });
});

describe('normaliseReferralCode', () => {
  it('upper-cases valid codes and rejects anything unsafe', async () => {
    const { normaliseReferralCode } = await import('../routes');
    expect(normaliseReferralCode('aarav101')).toBe('AARAV101');
    expect(normaliseReferralCode('%3Cscript%3E')).toBeNull();
    expect(normaliseReferralCode('ab')).toBeNull();
  });
});
