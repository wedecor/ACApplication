import type { WarrantyStatus } from '@/api/types';

export const WARRANTY_EXPIRING_WINDOW_DAYS = 30;

/**
 * Client-side mirror of the server's warranty computation — used to preview
 * the badge while the user edits dates, before the appliance is saved.
 */
export function computeWarrantyStatus(
  until: (string | null | undefined)[],
  now: Date = new Date(),
): { status: WarrantyStatus; daysLeft: number | null } {
  const times = until
    .filter((d): d is string => !!d)
    .map((d) => new Date(d).getTime())
    .filter((t) => !Number.isNaN(t));
  if (!times.length) return { status: 'UNKNOWN', daysLeft: null };
  const daysLeft = Math.ceil((Math.max(...times) - now.getTime()) / 86_400_000);
  if (daysLeft < 0) return { status: 'EXPIRED', daysLeft };
  if (daysLeft <= WARRANTY_EXPIRING_WINDOW_DAYS) return { status: 'EXPIRING_SOON', daysLeft };
  return { status: 'IN_WARRANTY', daysLeft };
}

export function warrantyLabel(status: WarrantyStatus, daysLeft: number | null): string {
  switch (status) {
    case 'IN_WARRANTY':
      return 'In warranty';
    case 'EXPIRING_SOON':
      return daysLeft === 0 ? 'Warranty ends today' : `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;
    case 'EXPIRED':
      return 'Warranty expired';
    default:
      return 'Warranty unknown';
  }
}

export function warrantyTone(status: WarrantyStatus): 'success' | 'warn' | 'danger' | 'neutral' {
  if (status === 'IN_WARRANTY') return 'success';
  if (status === 'EXPIRING_SOON') return 'warn';
  if (status === 'EXPIRED') return 'danger';
  return 'neutral';
}
