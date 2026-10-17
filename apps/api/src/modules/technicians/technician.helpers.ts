import { BookingStatus } from '@ac/types';

/** Bookings that still need the technician — block deactivation unless forced. */
export const OPEN_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.ASSIGNED,
  BookingStatus.TECHNICIAN_EN_ROUTE,
  BookingStatus.IN_PROGRESS,
  BookingStatus.WAITING_PARTS,
  BookingStatus.RESCHEDULED,
];

export const EMPLOYEE_CODE_PREFIX = 'TECH-';

/** `TECH-00042` — zero-padded to 5 digits, grows naturally beyond 99999. */
export function formatEmployeeCode(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError('sequence must be a positive integer');
  }
  return `${EMPLOYEE_CODE_PREFIX}${String(sequence).padStart(5, '0')}`;
}

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export type WorkingHours = Partial<Record<Weekday, [string, string][]>>;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Validates the `{ mon: [["09:00","18:00"]], ... }` shape stored in
 * `Technician.workingHours`. Returns a list of human-readable problems
 * (empty = valid). Windows must be well-formed, start < end, and not overlap.
 */
export function validateWorkingHours(value: unknown): string[] {
  const errors: string[] = [];
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return ['workingHours must be an object keyed by weekday (mon..sun)'];
  }
  for (const [day, windows] of Object.entries(value as Record<string, unknown>)) {
    if (!(WEEKDAYS as readonly string[]).includes(day)) {
      errors.push(`unknown weekday "${day}"`);
      continue;
    }
    if (!Array.isArray(windows)) {
      errors.push(`${day} must be an array of [start, end] pairs`);
      continue;
    }
    const parsed: [number, number][] = [];
    for (const w of windows) {
      if (
        !Array.isArray(w) ||
        w.length !== 2 ||
        typeof w[0] !== 'string' ||
        typeof w[1] !== 'string' ||
        !HHMM.test(w[0]) ||
        !HHMM.test(w[1])
      ) {
        errors.push(`${day} has a malformed window (expected ["HH:MM","HH:MM"])`);
        continue;
      }
      const start = toMinutes(w[0]);
      const end = toMinutes(w[1]);
      if (start >= end) {
        errors.push(`${day} window ${w[0]}-${w[1]} must start before it ends`);
        continue;
      }
      parsed.push([start, end]);
    }
    parsed.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < parsed.length; i++) {
      if (parsed[i]![0] < parsed[i - 1]![1]) {
        errors.push(`${day} has overlapping windows`);
        break;
      }
    }
  }
  return errors;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export interface BookingOutcomeCounts {
  completed: number;
  cancelled: number;
  noShow: number;
}

/**
 * Live completion rate from booking outcomes (0..1). Falls back to the stored
 * nightly aggregate when the technician has no finished bookings yet.
 */
export function computeCompletionRate(counts: BookingOutcomeCounts, fallback: number): number {
  const finished = counts.completed + counts.cancelled + counts.noShow;
  if (finished === 0) return fallback;
  return Math.round((counts.completed / finished) * 1000) / 1000;
}

export function buildFullName(firstName: string, lastName?: string | null): string {
  return [firstName.trim(), lastName?.trim()].filter(Boolean).join(' ');
}
