import { describe, expect, it } from 'vitest';

import {
  applyBps,
  computeQuoteTotals,
  type QuoteLine,
  roundHalfEven,
  toQuotationLineItems,
  upsertQuoteLine,
  validateQuoteLines,
} from '../quote-math';

const line = (over: Partial<QuoteLine> = {}): QuoteLine => ({
  key: 'k1',
  kind: 'CATALOG',
  description: 'Gas top-up',
  quantity: 1,
  unitPriceMinor: 100_00,
  discountMinor: 0,
  taxRateBps: 1800,
  ...over,
});

describe('quote maths', () => {
  it('rounds half to even like the server', () => {
    expect(roundHalfEven(2.5)).toBe(2);
    expect(roundHalfEven(3.5)).toBe(4);
    expect(roundHalfEven(2.4)).toBe(2);
    expect(applyBps(10_000, 1800)).toBe(1800);
    expect(applyBps(1, 5000)).toBe(0); // 0.5 → 0 (even)
  });

  it('computes subtotal, discount, tax and total', () => {
    const t = computeQuoteTotals([
      line({ key: 'a', quantity: 2, unitPriceMinor: 500_00, discountMinor: 100_00 }),
      line({ key: 'b', kind: 'LABOUR', unitPriceMinor: 250_00, taxRateBps: 0 }),
    ]);
    expect(t.lines[0]).toEqual({ key: 'a', subtotalMinor: 900_00, taxMinor: 162_00, totalMinor: 1062_00 });
    expect(t.subtotalMinor).toBe(1150_00);
    expect(t.discountMinor).toBe(100_00);
    expect(t.taxMinor).toBe(162_00);
    expect(t.totalMinor).toBe(1312_00);
  });

  it('drops tax when GST is disabled and never goes negative', () => {
    const t = computeQuoteTotals([line({ discountMinor: 999_00 })], false);
    expect(t.totalMinor).toBe(0);
    expect(t.taxMinor).toBe(0);
  });

  it('validates lines', () => {
    expect(validateQuoteLines([])).toContain('Add at least one line item.');
    expect(validateQuoteLines([line()])).toEqual([]);
    expect(validateQuoteLines([line({ kind: 'PART', quantity: 3, maxQuantity: 2 })])[0]).toMatch(/only 2/);
    expect(validateQuoteLines([line({ quantity: 0 })])[0]).toMatch(/quantity/);
  });

  it('maps to the quotation DTO with kind prefixes', () => {
    const items = toQuotationLineItems([
      line({ kind: 'PART', description: 'Capacitor', taxRateBps: 0 }),
      line({ kind: 'LABOUR', description: 'Labour: Brazing', discountMinor: 10_00 }),
    ]);
    expect(items[0]).toEqual({ description: 'Part: Capacitor', quantity: 1, unitPriceMinor: 100_00 });
    expect(items[1]).toMatchObject({ description: 'Labour: Brazing', discountMinor: 10_00, taxRateBps: 1800 });
  });

  it('upserts catalog/part lines by refId, capped at van stock', () => {
    const first = upsertQuoteLine([], line({ kind: 'PART', refId: 'p1', maxQuantity: 2 }));
    const second = upsertQuoteLine(first, line({ key: 'k2', kind: 'PART', refId: 'p1', maxQuantity: 2 }));
    const third = upsertQuoteLine(second, line({ key: 'k3', kind: 'PART', refId: 'p1', maxQuantity: 2 }));
    expect(third).toHaveLength(1);
    expect(third[0]?.quantity).toBe(2);
    expect(upsertQuoteLine(first, line({ key: 'k4', kind: 'LABOUR' }))).toHaveLength(2);
  });
});
