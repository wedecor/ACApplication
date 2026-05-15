/**
 * SLA math helpers.
 *
 * Two calendars are supported:
 *   - **24×7** — raw wall-clock minutes elapsed.
 *   - **business-hours** — 9-hour day Mon..Sat, 09:00–18:00 IST. We approximate
 *     by treating each Sunday as a closed day. The implementation is
 *     intentionally simple — for tenants with holiday calendars we hook a
 *     pluggable `BusinessCalendar` interface in front of `addMinutes`.
 */
import { type TicketPriority, type TicketStatus, OPEN_TICKET_STATUSES } from '@ac/types';

export interface SlaProfileSnapshot {
  firstResponseMinutes: number;
  resolutionMinutes: number;
  businessHoursOnly: boolean;
  priorityOverrides: Record<
    TicketPriority,
    { firstResponseMinutes?: number; resolutionMinutes?: number } | undefined
  >;
}

export interface DueDates {
  firstResponseDueAt: Date;
  resolutionDueAt: Date;
}

export function computeDueDates(
  createdAt: Date,
  priority: TicketPriority,
  profile: SlaProfileSnapshot,
): DueDates {
  const override = profile.priorityOverrides[priority] ?? {};
  const firstResponseMin = override.firstResponseMinutes ?? profile.firstResponseMinutes;
  const resolutionMin = override.resolutionMinutes ?? profile.resolutionMinutes;
  const adder = profile.businessHoursOnly ? addBusinessMinutes : addMinutes;
  return {
    firstResponseDueAt: adder(createdAt, firstResponseMin),
    resolutionDueAt: adder(createdAt, resolutionMin),
  };
}

export function addMinutes(from: Date, minutes: number): Date {
  return new Date(from.getTime() + minutes * 60_000);
}

const BUSINESS_DAY_START_HOUR = 9; // 09:00
const BUSINESS_DAY_END_HOUR = 18; // 18:00

/**
 * Cheap business-hours adder — UTC-naïve but accurate enough for our
 * Mon..Sat 09:00–18:00 window. Treats Sundays as full holidays.
 */
export function addBusinessMinutes(from: Date, minutes: number): Date {
  let remaining = minutes;
  const cursor = new Date(from.getTime());
  while (remaining > 0) {
    const day = cursor.getUTCDay(); // 0=Sun, 6=Sat
    const hours = cursor.getUTCHours();
    const minutesOfDay = hours * 60 + cursor.getUTCMinutes();
    const startMin = BUSINESS_DAY_START_HOUR * 60;
    const endMin = BUSINESS_DAY_END_HOUR * 60;

    if (day === 0) {
      // Skip Sunday → bump to Monday 09:00.
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      cursor.setUTCHours(BUSINESS_DAY_START_HOUR, 0, 0, 0);
      continue;
    }
    if (minutesOfDay < startMin) {
      cursor.setUTCHours(BUSINESS_DAY_START_HOUR, 0, 0, 0);
      continue;
    }
    if (minutesOfDay >= endMin) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      cursor.setUTCHours(BUSINESS_DAY_START_HOUR, 0, 0, 0);
      continue;
    }
    const minutesLeftToday = endMin - minutesOfDay;
    if (remaining <= minutesLeftToday) {
      cursor.setTime(cursor.getTime() + remaining * 60_000);
      remaining = 0;
    } else {
      remaining -= minutesLeftToday;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      cursor.setUTCHours(BUSINESS_DAY_START_HOUR, 0, 0, 0);
    }
  }
  return cursor;
}

export function minutesUntil(target: Date, now: Date = new Date()): number {
  return Math.round((target.getTime() - now.getTime()) / 60_000);
}

export function isOverdue(target: Date | null | undefined, now: Date = new Date()): boolean {
  return target != null && target.getTime() < now.getTime();
}

/**
 * Returns true when the ticket status is "active" — SLA timers are still
 * running. Resolved / closed tickets stop the clock.
 */
export function isSlaActive(status: TicketStatus): boolean {
  return OPEN_TICKET_STATUSES.has(status);
}

/**
 * Default warning window — fire breach-warning events when we're within
 * 15% of the SLA target. Capped at 60 minutes so very short SLAs don't
 * fire too late.
 */
export function warningWindowMinutes(totalMinutes: number): number {
  return Math.min(60, Math.max(5, Math.round(totalMinutes * 0.15)));
}
