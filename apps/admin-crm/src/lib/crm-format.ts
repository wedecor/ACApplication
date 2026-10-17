/**
 * CRM form helpers (rupee input <-> minor units, datetime-local inputs, API error text).
 * Display formatting lives in `@/lib/format`.
 */

export { formatDate, formatDateTime } from './format';

export function formatINR(minor: number | null | undefined): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format((minor ?? 0) / 100);
}

/** Convert a rupee amount typed by a user into integer minor units (paise). */
export function rupeesToMinor(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function minorToRupees(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return '';
  return String(minor / 100);
}

/** `datetime-local` input value (local time) → ISO string, or undefined when blank. */
export function localInputToIso(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** ISO → `datetime-local` input value in local time. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (!err) return fallback;
  const e = err as { details?: unknown; message?: string };
  const details = e.details as { message?: unknown } | string | undefined;
  if (typeof details === 'string') return details;
  if (details && typeof details === 'object' && 'message' in details) {
    const m = details.message;
    if (typeof m === 'string') return m;
    if (Array.isArray(m)) return m.join(', ');
  }
  return e.message ?? fallback;
}

export function splitTags(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
