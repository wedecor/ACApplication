import { describe, expect, it } from 'vitest';

import { formatMinor, minorToRupeesInput, rupeesToMinor } from '../money';

describe('money', () => {
  it('formats paise as rupees', () => {
    expect(formatMinor(123_456_00)).toBe('₹1,23,456');
    expect(formatMinor(1050)).toBe('₹10.50');
    expect(formatMinor(-500)).toBe('-₹5');
    expect(formatMinor(null)).toBe('₹0');
  });

  it('parses rupee input into paise', () => {
    expect(rupeesToMinor('1,250')).toBe(125_000);
    expect(rupeesToMinor('499.5')).toBe(49_950);
    expect(rupeesToMinor('₹ 10.05')).toBe(1005);
    expect(rupeesToMinor('')).toBeNull();
    expect(rupeesToMinor('1.234')).toBeNull();
    expect(rupeesToMinor('-5')).toBeNull();
  });

  it('round-trips to input text', () => {
    expect(minorToRupeesInput(125_050)).toBe('1250.50');
    expect(minorToRupeesInput(1000)).toBe('10');
  });
});
