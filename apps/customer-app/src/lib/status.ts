import type { BookingSummary } from '@/api/types';

export type StatusTone = 'neutral' | 'brand' | 'success' | 'warn' | 'danger';

/** Customer-facing booking status copy and colour, shared by every screen that shows a booking. */
export const BOOKING_STATUS_LABEL: Record<BookingSummary['status'], string> = {
  CREATED: 'Booked',
  CONFIRMED: 'Confirmed',
  ASSIGNED: 'Pro assigned',
  EN_ROUTE: 'On the way',
  ARRIVED: 'Arrived',
  IN_PROGRESS: 'In progress',
  AWAITING_PARTS: 'Awaiting parts',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No show',
};

export const BOOKING_STATUS_TONE: Record<BookingSummary['status'], StatusTone> = {
  CREATED: 'neutral',
  CONFIRMED: 'brand',
  ASSIGNED: 'brand',
  EN_ROUTE: 'warn',
  ARRIVED: 'success',
  IN_PROGRESS: 'success',
  AWAITING_PARTS: 'warn',
  COMPLETED: 'neutral',
  CANCELLED: 'danger',
  NO_SHOW: 'danger',
};

/** "PARTIALLY_PAID" → "Partially paid" for statuses without curated copy. */
export function humanizeStatus(value: string | null | undefined): string {
  if (!value) return '';
  const s = value.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
