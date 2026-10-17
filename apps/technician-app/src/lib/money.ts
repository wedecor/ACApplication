/**
 * Money helpers for the field app. All amounts are integer minor units
 * (paise). Formatting matches the existing `₹{(minor / 100).toLocaleString('en-IN')}`
 * style used on the inventory screens, but always shows paise when present.
 *
 * Pure — no React Native imports — so it is unit-testable under vitest.
 */

export function formatMinor(minor: number | null | undefined): string {
  const value = Number.isFinite(minor) ? (minor!) : 0;
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(Math.round(value));
  const hasPaise = abs % 100 !== 0;
  const rupees = (abs / 100).toLocaleString('en-IN', {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${sign}₹${rupees}`;
}

/**
 * Parse a rupee amount typed by the technician ("1,250", "499.5") into
 * integer paise. Returns null for empty / invalid / negative input.
 */
export function rupeesToMinor(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, '');
  if (cleaned === '' || !/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole = '0', frac = ''] = cleaned.split('.');
  const paise = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return Number.isSafeInteger(paise) ? paise : null;
}

/** Inverse of `rupeesToMinor` for pre-filling inputs ("1250.5" → "1250.50"). */
export function minorToRupeesInput(minor: number): string {
  const abs = Math.abs(Math.round(minor));
  const whole = Math.floor(abs / 100);
  const paise = abs % 100;
  return paise === 0 ? String(whole) : `${whole}.${String(paise).padStart(2, '0')}`;
}
