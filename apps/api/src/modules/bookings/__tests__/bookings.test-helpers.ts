import type { AuthPrincipal } from '@ac/auth';
import { BookingStatus } from '@ac/types';

import { BookingsService } from '../bookings.service';

/**
 * Shared, intentionally loose mocks for BookingsService unit specs. Booking
 * rows only carry the fields the transition / OTP / reschedule logic reads, so
 * new optional columns on Booking do not break these tests.
 */

export const actor = {
  userId: 'user_1',
  tenantId: 'tenant_1',
  email: null,
  phone: null,
  roles: [],
  permissions: [],
  sessionId: 'sess_1',
  permissionVersion: 1,
  iat: 0,
  exp: 0,
} as unknown as AuthPrincipal;

export interface BookingRow {
  id: string;
  code: string;
  tenantId: string;
  status: BookingStatus;
  technicianId: string | null;
  cityId: string;
  category: string;
  scheduledAt: Date;
  scheduledTimeSlot: string | null;
  geoLatitude: number | null;
  geoLongitude: number | null;
  otpCodeHash: string | null;
  otpExpiresAt: Date | null;
  otpAttempts: number;
  otpVerifiedAt: Date | null;
  [extra: string]: unknown;
}

export function makeBooking(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    id: 'book_1',
    code: 'ACB-2026-000001',
    tenantId: 'tenant_1',
    status: BookingStatus.PENDING,
    technicianId: null,
    cityId: 'city_1',
    category: 'AC_REPAIR',
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    scheduledTimeSlot: '10:00-12:00',
    geoLatitude: null,
    geoLongitude: null,
    otpCodeHash: null,
    otpExpiresAt: null,
    otpAttempts: 0,
    otpVerifiedAt: null,
    ...overrides,
  };
}

export function buildService(booking: BookingRow | null = makeBooking()) {
  const tx = { __tx: true };
  const repo = {
    findById: jest.fn().mockResolvedValue(booking),
    // Echo the update back merged onto the current row, so `row.status` is realistic.
    update: jest.fn(async (id: string, data: Record<string, unknown>, _tx?: unknown) => ({
      ...(booking ?? {}),
      id,
      ...data,
    })),
    hasTechnicianConflict: jest.fn().mockResolvedValue(false),
    create: jest.fn(),
    nextCode: jest.fn(),
    list: jest.fn(),
  };
  const leads = { findById: jest.fn() };
  const assignment = { pickBest: jest.fn() };
  const activity = {
    recordBookingActivity: jest.fn().mockResolvedValue(undefined),
    recordLeadActivity: jest.fn().mockResolvedValue(undefined),
    listBookingActivities: jest.fn(),
  };
  const events = { publish: jest.fn() };
  const prisma = {
    client: {
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
      technician: { findFirst: jest.fn() },
    },
  };

  const svc = new BookingsService(
    repo as never,
    leads as never,
    assignment as never,
    activity as never,
    events as never,
    prisma as never,
  );
  return { svc, repo, leads, assignment, activity, events, prisma, tx };
}

/** Names of events published on the bus, in order. */
export function publishedEventNames(events: { publish: jest.Mock }): string[] {
  return events.publish.mock.calls.map((c: unknown[]) => c[0] as string);
}
