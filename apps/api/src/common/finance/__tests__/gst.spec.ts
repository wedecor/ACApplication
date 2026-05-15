import { computeInvoiceTotals, computeLineTax, defaultGstContext, isIntraState } from '../gst';

describe('GST computation', () => {
  describe('isIntraState', () => {
    it('is intra when place of supply matches the supplier', () => {
      expect(isIntraState(defaultGstContext({ supplierState: 'KA', placeOfSupply: 'KA' }))).toBe(
        true,
      );
    });
    it('is inter when place differs', () => {
      expect(isIntraState(defaultGstContext({ supplierState: 'KA', placeOfSupply: 'MH' }))).toBe(
        false,
      );
    });
    it('treats null place of supply as inter-state', () => {
      expect(isIntraState(defaultGstContext({ supplierState: 'KA', placeOfSupply: null }))).toBe(
        false,
      );
    });
  });

  describe('computeLineTax', () => {
    const intra = defaultGstContext({ supplierState: 'KA', placeOfSupply: 'KA' });
    const inter = defaultGstContext({ supplierState: 'KA', placeOfSupply: 'MH' });

    it('splits 18% GST into CGST/SGST 9/9 for intra-state', () => {
      const out = computeLineTax(
        { quantity: 1, unitPriceMinor: 100_000, taxRateBps: 1800 },
        intra,
      );
      expect(out.subtotalMinor).toBe(100_000);
      expect(out.taxMinor).toBe(18_000);
      expect(out.cgstMinor).toBe(9_000);
      expect(out.sgstMinor).toBe(9_000);
      expect(out.igstMinor).toBe(0);
      expect(out.totalMinor).toBe(118_000);
    });

    it('applies full IGST for inter-state', () => {
      const out = computeLineTax(
        { quantity: 1, unitPriceMinor: 100_000, taxRateBps: 1800 },
        inter,
      );
      expect(out.taxMinor).toBe(18_000);
      expect(out.cgstMinor).toBe(0);
      expect(out.sgstMinor).toBe(0);
      expect(out.igstMinor).toBe(18_000);
    });

    it('applies discount before tax', () => {
      const out = computeLineTax(
        { quantity: 2, unitPriceMinor: 50_000, discountMinor: 20_000, taxRateBps: 1800 },
        inter,
      );
      // gross = 100_000, post-discount = 80_000, tax = 14_400
      expect(out.subtotalMinor).toBe(80_000);
      expect(out.taxMinor).toBe(14_400);
      expect(out.totalMinor).toBe(94_400);
    });

    it('returns zero tax when gstEnabled is false', () => {
      const out = computeLineTax(
        { quantity: 1, unitPriceMinor: 100_000, taxRateBps: 1800 },
        defaultGstContext({ gstEnabled: false }),
      );
      expect(out.taxMinor).toBe(0);
      expect(out.totalMinor).toBe(100_000);
    });

    it('rejects non-integer line inputs', () => {
      expect(() =>
        computeLineTax({ quantity: 1.5, unitPriceMinor: 10000, taxRateBps: 1800 }, intra),
      ).toThrow();
    });
  });

  describe('computeInvoiceTotals', () => {
    const ctx = defaultGstContext({ supplierState: 'KA', placeOfSupply: 'KA' });
    it('aggregates two lines and applies invoice-level discount', () => {
      const { totals } = computeInvoiceTotals(
        [
          { quantity: 1, unitPriceMinor: 50_000, taxRateBps: 1800 },
          { quantity: 2, unitPriceMinor: 25_000, taxRateBps: 1800 },
        ],
        ctx,
        0,
      );
      // subtotal = 50_000 + 50_000 = 100_000; tax = 9_000 + 9_000 = 18_000
      expect(totals.subtotalMinor).toBe(100_000);
      expect(totals.taxMinor).toBe(18_000);
      expect(totals.cgstMinor + totals.sgstMinor).toBe(18_000);
      expect(totals.totalMinor).toBe(118_000);
    });

    it('caps invoice-level discount at total', () => {
      const { totals } = computeInvoiceTotals(
        [{ quantity: 1, unitPriceMinor: 10_000, taxRateBps: 0 }],
        ctx,
        50_000,
      );
      expect(totals.totalMinor).toBe(0);
      expect(totals.discountMinor).toBe(10_000);
    });
  });
});
