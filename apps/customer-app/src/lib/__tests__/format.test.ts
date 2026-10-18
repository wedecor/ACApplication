import { formatRupees, formatRupeesShort, initials, maskPhone } from '../format';

describe('formatRupees', () => {
  it('formats rupees from minor units', () => {
    expect(formatRupees(49900)).toContain('499');
  });
  it('renders a dash for null/undefined', () => {
    expect(formatRupees(null)).toBe('₹ —');
    expect(formatRupees(undefined)).toBe('₹ —');
  });
  it('applies a sign when requested', () => {
    expect(formatRupees(-49900, { showSign: true })).toContain('\u2212');
    expect(formatRupees(49900, { showSign: true })).toContain('+');
  });
});

describe('formatRupeesShort', () => {
  it('compresses thousands and lakhs', () => {
    expect(formatRupeesShort(150000)).toBe('₹1.5k');
    expect(formatRupeesShort(15000000)).toBe('₹1.5L');
    expect(formatRupeesShort(45000)).toBe('₹450');
  });
});

describe('maskPhone', () => {
  it('masks the middle digits', () => {
    expect(maskPhone('9876543210')).toMatch(/^987.+210$/);
  });
});

describe('initials', () => {
  it('returns the initial-pair', () => {
    expect(initials('Ravi Kumar')).toBe('RK');
    expect(initials('Ravi')).toBe('RA');
    expect(initials(null)).toBe('?');
  });
});
