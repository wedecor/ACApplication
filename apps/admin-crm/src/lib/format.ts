/**
 * Money / display helpers shared by every finance UI surface.
 *
 * All amounts coming back from the API are integer **minor units** (paise
 * for INR, cents for USD) so we never round in JavaScript-land.
 */

export const DEFAULT_CURRENCY = 'INR';

export function formatMinor(
  minor: number | bigint | null | undefined,
  currency: string = DEFAULT_CURRENCY,
  options: Intl.NumberFormatOptions = {},
): string {
  if (minor === null || minor === undefined) return '—';
  const value = Number(minor) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
    ...options,
  }).format(value);
}

export function formatMinorCompact(minor: number | bigint | null | undefined): string {
  if (minor === null || minor === undefined) return '—';
  const v = Number(minor) / 100;
  if (Math.abs(v) >= 1_00_00_000) return `₹${(v / 1_00_00_000).toFixed(2)}Cr`;
  if (Math.abs(v) >= 1_00_000) return `₹${(v / 1_00_000).toFixed(2)}L`;
  if (Math.abs(v) >= 1_000) return `₹${(v / 1_000).toFixed(1)}K`;
  return `₹${v.toFixed(0)}`;
}

export function formatPercent(value: number, fractionDigits = 1): string {
  if (!Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(fractionDigits)}%`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function rangeFromPreset(preset: 'today' | '7d' | '30d' | '90d' | 'mtd' | 'qtd' | 'ytd') {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  const from = new Date(now);
  switch (preset) {
    case 'today':
      from.setHours(0, 0, 0, 0);
      break;
    case '7d':
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      break;
    case '30d':
      from.setDate(from.getDate() - 29);
      from.setHours(0, 0, 0, 0);
      break;
    case '90d':
      from.setDate(from.getDate() - 89);
      from.setHours(0, 0, 0, 0);
      break;
    case 'mtd':
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      break;
    case 'qtd': {
      const q = Math.floor(from.getMonth() / 3) * 3;
      from.setMonth(q, 1);
      from.setHours(0, 0, 0, 0);
      break;
    }
    case 'ytd':
      from.setMonth(0, 1);
      from.setHours(0, 0, 0, 0);
      break;
  }
  return { from: from.toISOString(), to: to.toISOString() };
}
