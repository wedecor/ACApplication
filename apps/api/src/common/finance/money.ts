/**
 * Money — currency-safe arithmetic in **minor units** (paise / cents).
 *
 * Every public price/amount in this codebase is an integer count of minor
 * units. This file gives us tested, intent-revealing helpers so individual
 * services never reach for `Math.round` or `parseFloat`.
 *
 * Why integers?
 * -------------
 * IEEE-754 floats cannot represent 0.10 exactly, so the moment we do
 * `0.1 + 0.2` we have a phantom 4-femtopaise. In finance contexts those
 * pennies compound into legal liabilities (incorrect GST returns, mismatched
 * statements). We sidestep the whole class of bug by treating money as
 * `Int` and only converting at presentation time.
 */

export type MinorUnits = number;

const ZERO: MinorUnits = 0;

/** Defensive: refuse non-finite / fractional minor-unit values. */
export function ensureInteger(value: unknown, field = 'amount'): MinorUnits {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`${field} must be an integer count of minor units (got ${String(value)})`);
  }
  return value;
}

export function clampNonNegative(value: MinorUnits): MinorUnits {
  return value < 0 ? 0 : value;
}

export function sumMinor(values: readonly MinorUnits[]): MinorUnits {
  let total = ZERO;
  for (const v of values) total += ensureInteger(v);
  return total;
}

/** Banker's rounding (round-half-to-even) — preferred for GST tax math. */
export function roundHalfEven(value: number): MinorUnits {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

/**
 * Apply a basis-point rate to a minor-unit base.
 *
 * `applyBps(10000, 1800) === 1800` (18 % of ₹100.00 = ₹18.00)
 */
export function applyBps(baseMinor: MinorUnits, bps: number): MinorUnits {
  if (!Number.isFinite(bps) || bps < 0) {
    throw new Error(`Tax rate (bps) must be a non-negative finite number (got ${String(bps)})`);
  }
  return roundHalfEven((ensureInteger(baseMinor) * bps) / 10_000);
}

/**
 * Subtract `b` from `a`, never producing a negative integer. This is the
 * idiom for "discount but don't go below zero" semantics.
 */
export function subtractFloorZero(a: MinorUnits, b: MinorUnits): MinorUnits {
  const diff = ensureInteger(a) - ensureInteger(b);
  return diff < 0 ? 0 : diff;
}

export interface FormatMinorOptions {
  /** ISO 4217 — defaults to INR. */
  currency?: string;
  /** Locale for grouping; defaults to en-IN for Indian comma grouping. */
  locale?: string;
}

/** Pretty-print money for UIs and PDFs (NOT for arithmetic). */
export function formatMinor(value: MinorUnits, opts: FormatMinorOptions = {}): string {
  const { currency = 'INR', locale = 'en-IN' } = opts;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(ensureInteger(value) / 100);
}

/** ₹ 1,23,456.00 → 12345600 (minor units). Used by import / migration jobs only. */
export function rupeesToMinor(rupees: number): MinorUnits {
  if (!Number.isFinite(rupees)) throw new Error('rupees must be finite');
  return roundHalfEven(rupees * 100);
}
