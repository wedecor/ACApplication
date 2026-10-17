/**
 * Phone normalisation to E.164.
 *
 * Rules (India-first, since that is the primary market):
 *   • strip spaces, dashes, dots, parentheses
 *   • "00" international prefix → "+"
 *   • already "+<digits>" with 8–15 digits → kept
 *   • 10-digit national number starting 6–9 → "+91" prefix
 *   • 11-digit with leading trunk "0" (e.g. 09876543210) → "+91"
 *   • 12-digit starting "91" followed by a valid mobile → "+91…"
 *   • anything else → null (invalid)
 */
export function normalizePhoneE164(input: unknown, defaultCountryCode = '91'): string | null {
  if (typeof input !== 'string' && typeof input !== 'number') return null;
  let raw = String(input).trim();
  if (!raw) return null;
  if (/[a-z]/i.test(raw)) return null;

  raw = raw.replace(/[\s\-().]/g, '');
  if (raw.startsWith('00')) raw = `+${raw.slice(2)}`;

  if (raw.startsWith('+')) {
    const digits = raw.slice(1);
    if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
    if (digits.startsWith('91') && !/^91[6-9]\d{9}$/.test(digits)) return null;
    return `+${digits}`;
  }

  if (!/^\d+$/.test(raw)) return null;

  if (defaultCountryCode === '91') {
    if (/^[6-9]\d{9}$/.test(raw)) return `+91${raw}`;
    if (/^0[6-9]\d{9}$/.test(raw)) return `+91${raw.slice(1)}`;
    if (/^91[6-9]\d{9}$/.test(raw)) return `+${raw}`;
    return null;
  }

  const national = raw.replace(/^0+/, '');
  const full = `${defaultCountryCode}${national}`;
  return /^[1-9]\d{7,14}$/.test(full) ? `+${full}` : null;
}

/** Candidate spellings of the same number (used to match legacy un-normalised rows). */
export function phoneVariants(e164: string): string[] {
  const out = new Set<string>([e164]);
  if (e164.startsWith('+91')) {
    const national = e164.slice(3);
    out.add(national);
    out.add(`91${national}`);
    out.add(`0${national}`);
  } else {
    out.add(e164.slice(1));
  }
  return [...out];
}
