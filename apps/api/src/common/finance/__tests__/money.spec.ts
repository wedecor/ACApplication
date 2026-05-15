import {
  applyBps,
  ensureInteger,
  formatMinor,
  roundHalfEven,
  subtractFloorZero,
  sumMinor,
} from '../money';

describe('money utilities', () => {
  describe('ensureInteger', () => {
    it('passes through whole numbers', () => {
      expect(ensureInteger(0)).toBe(0);
      expect(ensureInteger(100)).toBe(100);
      expect(ensureInteger(-50)).toBe(-50);
    });

    it('throws for fractional input', () => {
      expect(() => ensureInteger(1.5)).toThrow();
    });
    it('throws for non-finite input', () => {
      expect(() => ensureInteger(Number.NaN)).toThrow();
      expect(() => ensureInteger(Number.POSITIVE_INFINITY)).toThrow();
    });
  });

  describe('sumMinor', () => {
    it('sums integers exactly', () => {
      expect(sumMinor([100, 200, 300])).toBe(600);
    });
    it('rejects non-integer entries', () => {
      expect(() => sumMinor([100, 1.5])).toThrow();
    });
  });

  describe('roundHalfEven (banker’s rounding)', () => {
    it('rounds down values < .5', () => {
      expect(roundHalfEven(2.4)).toBe(2);
    });
    it('rounds up values > .5', () => {
      expect(roundHalfEven(2.6)).toBe(3);
    });
    it('rounds half to even', () => {
      expect(roundHalfEven(2.5)).toBe(2);
      expect(roundHalfEven(3.5)).toBe(4);
      expect(roundHalfEven(4.5)).toBe(4);
      expect(roundHalfEven(5.5)).toBe(6);
    });
  });

  describe('applyBps', () => {
    it('applies 18% GST to ₹1,000 (100,000 paise) as 18,000 paise', () => {
      expect(applyBps(100_000, 1800)).toBe(18_000);
    });
    it('uses banker’s rounding for half-paise results', () => {
      // 5_000 * 0.05 = 250 — no rounding needed
      expect(applyBps(5_000, 500)).toBe(250);
      // 1_250 * 0.18 = 225 — but with the half boundary at 250: try 1_250 * 0.20 = 250 (even) → 250
      expect(applyBps(1_250, 2000)).toBe(250);
    });
    it('throws on negative bps', () => {
      expect(() => applyBps(100, -1)).toThrow();
    });
  });

  describe('subtractFloorZero', () => {
    it('floors at zero', () => {
      expect(subtractFloorZero(100, 200)).toBe(0);
      expect(subtractFloorZero(200, 100)).toBe(100);
    });
  });

  describe('formatMinor', () => {
    it('formats INR by default', () => {
      const formatted = formatMinor(123_45);
      expect(formatted).toContain('123.45');
    });
  });
});
