/**
 * Pure pricing + slot helpers for the customer booking flow. Kept free of
 * Prisma so they can be unit-tested exhaustively.
 */
import type { ServiceCategory } from '@ac/types';

// ------------------------------------------------------------------ time

/** Offset (minutes) of `tz` from UTC at instant `at`. IST → +330. */
export function tzOffsetMinutes(at: Date, tz: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, number> = {};
  for (const p of fmt.formatToParts(at)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  const asUtc = Date.UTC(parts.year!, parts.month! - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** Wall-clock `date` (YYYY-MM-DD) + `hour` in `tz` → UTC instant. */
export function zonedTimeToUtc(date: string, hour: number, tz: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const guess = new Date(Date.UTC(y, m - 1, d, hour, 0, 0));
  const offset = tzOffsetMinutes(guess, tz);
  const first = new Date(guess.getTime() - offset * 60_000);
  // Re-check once to handle DST boundaries.
  const offset2 = tzOffsetMinutes(first, tz);
  return offset2 === offset ? first : new Date(guess.getTime() - offset2 * 60_000);
}

/** `HH:MM` wall-clock in `tz`. */
export function formatLocalTime(at: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
}

/** `10:00-12:00` — fits Booking.scheduledTimeSlot (≤ 20 chars). */
export function timeSlotLabel(start: Date, end: Date | null, tz: string): string {
  return end ? `${formatLocalTime(start, tz)}-${formatLocalTime(end, tz)}` : formatLocalTime(start, tz);
}

// ----------------------------------------------------------------- slots

export const SLOT_WINDOWS: readonly { startHour: number; endHour: number }[] = [
  { startHour: 8, endHour: 11 },
  { startHour: 11, endHour: 14 },
  { startHour: 14, endHour: 17 },
  { startHour: 17, endHour: 20 },
];

/** Minimum notice before a slot can still be booked. */
export const SLOT_LEAD_MINUTES = 60;

export interface SlotInput {
  date: string;
  tz: string;
  /** Technicians in the city holding the required skill. */
  technicians: { dailyCapacity: number }[];
  /** Non-cancelled bookings already scheduled for that day (same city + category). */
  bookings: { scheduledAt: Date }[];
  now?: Date;
}

/**
 * Splits each skilled technician's daily capacity across the day's windows
 * and marks a window available while booked jobs < capacity and the window
 * starts at least {@link SLOT_LEAD_MINUTES} from now.
 */
export function computeSlots(input: SlotInput): { start: string; end: string; available: boolean }[] {
  const now = input.now ?? new Date();
  const perWindow = input.technicians.reduce(
    (sum, t) => sum + Math.max(1, Math.floor(t.dailyCapacity / SLOT_WINDOWS.length)),
    0,
  );
  return SLOT_WINDOWS.map((w) => {
    const start = zonedTimeToUtc(input.date, w.startHour, input.tz);
    const end = zonedTimeToUtc(input.date, w.endHour, input.tz);
    const booked = input.bookings.filter(
      (b) => b.scheduledAt.getTime() >= start.getTime() && b.scheduledAt.getTime() < end.getTime(),
    ).length;
    const leadOk = start.getTime() - now.getTime() >= SLOT_LEAD_MINUTES * 60_000;
    return { start: start.toISOString(), end: end.toISOString(), available: leadOk && booked < perWindow };
  });
}

// --------------------------------------------------------------- pricing

/** Used only when the tenant has not configured a ServiceCatalogItem for the category. */
export const DEFAULT_ESTIMATES: Record<ServiceCategory, { minor: number; minutes: number }> = {
  AC_REPAIR: { minor: 49900, minutes: 60 },
  AC_INSTALLATION: { minor: 149900, minutes: 120 },
  AC_SERVICING: { minor: 59900, minutes: 60 },
  REFRIGERATOR: { minor: 39900, minutes: 60 },
  WASHING_MACHINE: { minor: 34900, minutes: 60 },
  MICROWAVE: { minor: 29900, minutes: 45 },
  GEYSER: { minor: 24900, minutes: 45 },
  CHIMNEY: { minor: 39900, minutes: 60 },
  TELEVISION: { minor: 49900, minutes: 45 },
  WATER_PURIFIER: { minor: 29900, minutes: 45 },
  DISHWASHER: { minor: 44900, minutes: 60 },
  AIR_COOLER: { minor: 29900, minutes: 45 },
  INVERTER_UPS: { minor: 34900, minutes: 45 },
  CEILING_FAN: { minor: 19900, minutes: 30 },
  OVEN: { minor: 34900, minutes: 45 },
  VACUUM_CLEANER: { minor: 29900, minutes: 45 },
  ELECTRICAL_WIRING: { minor: 29900, minutes: 60 },
  OTHER: { minor: 39900, minutes: 60 },
};

export const EMERGENCY_SURGE_MULTIPLIER = 1.4;

export interface CatalogItemLike {
  id: string;
  code: string;
  name: string;
  basePriceMinor: number;
  visitChargeMinor: number;
  estimatedMinutes: number;
  sortOrder: number;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Pick the catalog item for an issue: exact code/name match on the issue
 * slug first, then a containment match, then the first item by sortOrder.
 */
export function pickCatalogItem<T extends CatalogItemLike>(items: T[], issueId?: string | null): T | null {
  if (!items.length) return null;
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  if (issueId) {
    const key = norm(issueId);
    const exact = sorted.find((i) => norm(i.code) === key || norm(i.name) === key);
    if (exact) return exact;
    const partial = sorted.find((i) => norm(i.code).includes(key) || norm(i.name).includes(key));
    if (partial) return partial;
  }
  return sorted[0]!;
}

export function computeEstimate(input: {
  category: ServiceCategory;
  issueId?: string | null;
  isEmergency?: boolean;
  catalog: CatalogItemLike[];
}): { estimateMinor: number; visitMinutes: number; surgeMultiplier: number; catalogItemId: string | null } {
  const item = pickCatalogItem(input.catalog, input.issueId);
  const surge = input.isEmergency ? EMERGENCY_SURGE_MULTIPLIER : 1;
  const base = item
    ? item.basePriceMinor + item.visitChargeMinor
    : DEFAULT_ESTIMATES[input.category]?.minor ?? DEFAULT_ESTIMATES.OTHER.minor;
  const minutes = item ? item.estimatedMinutes : DEFAULT_ESTIMATES[input.category]?.minutes ?? 60;
  return {
    estimateMinor: Math.round(base * surge),
    visitMinutes: minutes,
    surgeMultiplier: surge,
    catalogItemId: item?.id ?? null,
  };
}
