import {
  ActivityType,
  BookingStatus,
  canTransitionBooking,
  DomainEventName,
  TERMINAL_BOOKING_STATUSES,
} from '@ac/types';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { actor, buildService, makeBooking, publishedEventNames } from './bookings.test-helpers';

const S = BookingStatus;
const ALL_STATUSES = Object.values(BookingStatus);

/**
 * Pinned copy of the current state machine. Kept explicit (rather than
 * importing BOOKING_TRANSITIONS) so an accidental change to the shared table
 * fails loudly here.
 */
const EXPECTED_ALLOWED: Record<BookingStatus, BookingStatus[]> = {
  [S.DRAFT]: [S.PENDING, S.CANCELLED],
  [S.PENDING]: [S.CONFIRMED, S.ASSIGNED, S.CANCELLED],
  [S.CONFIRMED]: [S.ASSIGNED, S.CANCELLED, S.RESCHEDULED],
  [S.ASSIGNED]: [S.TECHNICIAN_EN_ROUTE, S.RESCHEDULED, S.CANCELLED, S.NO_SHOW],
  [S.TECHNICIAN_EN_ROUTE]: [S.IN_PROGRESS, S.NO_SHOW, S.CANCELLED],
  [S.IN_PROGRESS]: [S.WAITING_PARTS, S.COMPLETED, S.CANCELLED],
  [S.WAITING_PARTS]: [S.IN_PROGRESS, S.CANCELLED],
  [S.RESCHEDULED]: [S.PENDING, S.CONFIRMED, S.CANCELLED],
  [S.COMPLETED]: [],
  [S.CANCELLED]: [],
  [S.NO_SHOW]: [],
};

const allowedPairs: [BookingStatus, BookingStatus][] = [];
const forbiddenPairs: [BookingStatus, BookingStatus][] = [];
for (const from of ALL_STATUSES) {
  for (const to of ALL_STATUSES) {
    (EXPECTED_ALLOWED[from].includes(to) ? allowedPairs : forbiddenPairs).push([from, to]);
  }
}

describe('Booking state machine (canTransitionBooking)', () => {
  it.each(allowedPairs)('allows %s -> %s', (from, to) => {
    expect(canTransitionBooking(from, to)).toBe(true);
  });

  it.each(forbiddenPairs)('forbids %s -> %s', (from, to) => {
    expect(canTransitionBooking(from, to)).toBe(false);
  });

  it('never allows a self-transition', () => {
    for (const s of ALL_STATUSES) expect(canTransitionBooking(s, s)).toBe(false);
  });

  it('treats COMPLETED, CANCELLED and NO_SHOW as terminal with no exits', () => {
    expect([...TERMINAL_BOOKING_STATUSES].sort()).toEqual(
      [S.CANCELLED, S.COMPLETED, S.NO_SHOW].sort(),
    );
    for (const t of TERMINAL_BOOKING_STATUSES) {
      for (const to of ALL_STATUSES) expect(canTransitionBooking(t, to)).toBe(false);
    }
  });

  it('allows CANCELLED from every non-terminal state', () => {
    for (const s of ALL_STATUSES) {
      if (TERMINAL_BOOKING_STATUSES.has(s)) continue;
      expect(canTransitionBooking(s, S.CANCELLED)).toBe(true);
    }
  });
});

describe('BookingsService.changeStatus', () => {
  it('throws NotFound when the booking does not exist in the tenant', async () => {
    const { svc, repo } = buildService(null);
    await expect(
      svc.changeStatus(actor, 'missing', { status: S.CONFIRMED }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findById).toHaveBeenCalledWith('tenant_1', 'missing');
    expect(repo.update).not.toHaveBeenCalled();
  });

  it.each(forbiddenPairs)(
    'rejects %s -> %s with Forbidden and writes nothing',
    async (from, to) => {
      const { svc, repo, activity, events } = buildService(makeBooking({ status: from }));
      const p = svc.changeStatus(actor, 'book_1', { status: to });
      await expect(p).rejects.toBeInstanceOf(ForbiddenException);
      await expect(p).rejects.toThrow(`Cannot transition booking from ${from} to ${to}`);
      expect(repo.update).not.toHaveBeenCalled();
      expect(activity.recordBookingActivity).not.toHaveBeenCalled();
      expect(events.publish).not.toHaveBeenCalled();
    },
  );

  it.each(allowedPairs)('accepts %s -> %s and persists the new status', async (from, to) => {
    const { svc, repo, tx, events } = buildService(makeBooking({ status: from }));
    const result = await svc.changeStatus(actor, 'book_1', { status: to });
    expect(repo.update).toHaveBeenCalledTimes(1);
    expect(repo.update).toHaveBeenCalledWith(
      'book_1',
      expect.objectContaining({ status: to, updatedBy: 'user_1' }),
      tx,
    );
    expect(result).toEqual(expect.objectContaining({ status: to }));
    expect(events.publish).toHaveBeenCalledWith(DomainEventName.BookingStatusChanged, {
      bookingId: 'book_1',
      from,
      to,
    });
  });

  describe('timestamps', () => {
    const cases: [BookingStatus, BookingStatus, string][] = [
      [S.ASSIGNED, S.TECHNICIAN_EN_ROUTE, 'enRouteAt'],
      [S.TECHNICIAN_EN_ROUTE, S.IN_PROGRESS, 'startedAt'],
      [S.IN_PROGRESS, S.WAITING_PARTS, 'waitingPartsAt'],
      [S.IN_PROGRESS, S.COMPLETED, 'completedAt'],
      [S.PENDING, S.CANCELLED, 'cancelledAt'],
    ];

    it.each(cases)('%s -> %s stamps %s', async (from, to, field) => {
      const { svc, repo } = buildService(makeBooking({ status: from }));
      await svc.changeStatus(actor, 'book_1', { status: to });
      const data = repo.update.mock.calls[0]![1];
      expect(data[field]).toBeInstanceOf(Date);
      const otherStamps = ['enRouteAt', 'startedAt', 'waitingPartsAt', 'completedAt', 'cancelledAt']
        .filter((f) => f !== field);
      for (const f of otherStamps) expect(data[f]).toBeUndefined();
    });

    it('PENDING -> CONFIRMED stamps nothing', async () => {
      const { svc, repo } = buildService(makeBooking({ status: S.PENDING }));
      await svc.changeStatus(actor, 'book_1', { status: S.CONFIRMED });
      const data = repo.update.mock.calls[0]![1];
      for (const f of ['enRouteAt', 'startedAt', 'waitingPartsAt', 'completedAt', 'cancelledAt']) {
        expect(data[f]).toBeUndefined();
      }
    });
  });

  describe('activity type', () => {
    const cases: [BookingStatus, BookingStatus, string][] = [
      [S.IN_PROGRESS, S.COMPLETED, ActivityType.COMPLETED],
      [S.ASSIGNED, S.CANCELLED, ActivityType.CANCELLED],
      [S.IN_PROGRESS, S.WAITING_PARTS, ActivityType.WAITING_PARTS],
      [S.WAITING_PARTS, S.IN_PROGRESS, ActivityType.WORK_RESUMED],
      [S.TECHNICIAN_EN_ROUTE, S.IN_PROGRESS, ActivityType.STATUS_CHANGED],
      [S.ASSIGNED, S.TECHNICIAN_EN_ROUTE, ActivityType.TECHNICIAN_EN_ROUTE],
      [S.PENDING, S.CONFIRMED, ActivityType.STATUS_CHANGED],
      [S.ASSIGNED, S.NO_SHOW, ActivityType.STATUS_CHANGED],
    ];

    it.each(cases)('%s -> %s records %s', async (from, to, type) => {
      const { svc, activity, tx } = buildService(makeBooking({ status: from }));
      await svc.changeStatus(actor, 'book_1', { status: to, reason: 'why' });
      expect(activity.recordBookingActivity).toHaveBeenCalledWith(
        'book_1',
        expect.objectContaining({
          tenantId: 'tenant_1',
          type,
          actorUserId: 'user_1',
          fromStatus: from,
          toStatus: to,
          message: 'why',
        }),
        tx,
      );
    });
  });

  describe('COMPLETED', () => {
    it('records finalAmountMinor and publishes BookingCompleted', async () => {
      const { svc, repo, events, activity } = buildService(
        makeBooking({ status: S.IN_PROGRESS, technicianId: 'tech_1' }),
      );
      await svc.changeStatus(actor, 'book_1', { status: S.COMPLETED, finalAmountMinor: 150_000 });
      expect(repo.update.mock.calls[0]![1]).toEqual(
        expect.objectContaining({ finalAmountMinor: 150_000 }),
      );
      expect(activity.recordBookingActivity.mock.calls[0]![1]).toEqual(
        expect.objectContaining({ metadata: { finalAmountMinor: 150_000 } }),
      );
      expect(publishedEventNames(events)).toEqual([
        DomainEventName.BookingStatusChanged,
        DomainEventName.BookingCompleted,
      ]);
      expect(events.publish).toHaveBeenCalledWith(DomainEventName.BookingCompleted, {
        bookingId: 'book_1',
        technicianId: 'tech_1',
        finalAmountMinor: 150_000,
      });
    });

    it('leaves finalAmountMinor untouched when not provided', async () => {
      const { svc, repo, events } = buildService(makeBooking({ status: S.IN_PROGRESS }));
      await svc.changeStatus(actor, 'book_1', { status: S.COMPLETED });
      expect((repo.update.mock.calls[0]![1]).finalAmountMinor).toBeUndefined();
      expect(events.publish).toHaveBeenCalledWith(DomainEventName.BookingCompleted, {
        bookingId: 'book_1',
        technicianId: null,
        finalAmountMinor: null,
      });
    });

    it('ignores finalAmountMinor on non-COMPLETED transitions', async () => {
      const { svc, repo } = buildService(makeBooking({ status: S.IN_PROGRESS }));
      await svc.changeStatus(actor, 'book_1', { status: S.WAITING_PARTS, finalAmountMinor: 99 });
      expect((repo.update.mock.calls[0]![1]).finalAmountMinor).toBeUndefined();
    });
  });

  describe('CANCELLED', () => {
    it('stores the cancellation reason and publishes BookingCancelled', async () => {
      const { svc, repo, events } = buildService(makeBooking({ status: S.CONFIRMED }));
      await svc.changeStatus(actor, 'book_1', { status: S.CANCELLED, reason: 'Customer away' });
      expect(repo.update.mock.calls[0]![1]).toEqual(
        expect.objectContaining({ cancellationReason: 'Customer away' }),
      );
      expect(publishedEventNames(events)).toEqual([
        DomainEventName.BookingStatusChanged,
        DomainEventName.BookingCancelled,
      ]);
      expect(events.publish).toHaveBeenCalledWith(DomainEventName.BookingCancelled, {
        bookingId: 'book_1',
        reason: 'Customer away',
      });
    });

    it('stores a null cancellation reason when none is given', async () => {
      const { svc, repo } = buildService(makeBooking({ status: S.CONFIRMED }));
      await svc.changeStatus(actor, 'book_1', { status: S.CANCELLED });
      expect((repo.update.mock.calls[0]![1]).cancellationReason).toBeNull();
    });

    it('does not touch cancellationReason on other transitions', async () => {
      const { svc, repo } = buildService(makeBooking({ status: S.PENDING }));
      await svc.changeStatus(actor, 'book_1', { status: S.CONFIRMED, reason: 'ok' });
      expect((repo.update.mock.calls[0]![1]).cancellationReason).toBeUndefined();
    });
  });

  it('does not publish events if the transaction fails', async () => {
    const { svc, repo, events } = buildService(makeBooking({ status: S.PENDING }));
    repo.update.mockRejectedValueOnce(new Error('db down'));
    await expect(svc.changeStatus(actor, 'book_1', { status: S.CONFIRMED })).rejects.toThrow('db down');
    expect(events.publish).not.toHaveBeenCalled();
  });
});

describe('BookingsService.assignTechnician — status side', () => {
  it.each([...TERMINAL_BOOKING_STATUSES])('refuses to assign a %s booking', async (status) => {
    const { svc, repo } = buildService(makeBooking({ status }));
    await expect(
      svc.assignTechnician(actor, 'book_1', { technicianId: 'tech_1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('moves the booking to ASSIGNED and records ASSIGNED activity', async () => {
    const { svc, repo, prisma, activity, events, tx } = buildService(
      makeBooking({ status: S.PENDING }),
    );
    prisma.client.technician.findFirst.mockResolvedValue({
      id: 'tech_1',
      skills: ['AC_REPAIR'],
      status: 'AVAILABLE',
    });
    await svc.assignTechnician(actor, 'book_1', { technicianId: 'tech_1' });
    expect(repo.update).toHaveBeenCalledWith(
      'book_1',
      expect.objectContaining({
        status: S.ASSIGNED,
        technician: { connect: { id: 'tech_1' } },
        assignedAt: expect.any(Date),
      }),
      tx,
    );
    expect(activity.recordBookingActivity.mock.calls[0]![1]).toEqual(
      expect.objectContaining({
        type: ActivityType.ASSIGNED,
        fromStatus: S.PENDING,
        toStatus: S.ASSIGNED,
      }),
    );
    expect(events.publish).toHaveBeenCalledWith(DomainEventName.BookingAssigned, {
      bookingId: 'book_1',
      technicianId: 'tech_1',
    });
  });

  it('records REASSIGNED when a technician was already set', async () => {
    const { svc, prisma, activity } = buildService(
      makeBooking({ status: S.ASSIGNED, technicianId: 'tech_old' }),
    );
    prisma.client.technician.findFirst.mockResolvedValue({
      id: 'tech_new',
      skills: ['AC_REPAIR'],
      status: 'AVAILABLE',
    });
    await svc.assignTechnician(actor, 'book_1', { technicianId: 'tech_new' });
    expect(activity.recordBookingActivity.mock.calls[0]![1]).toEqual(
      expect.objectContaining({
        type: ActivityType.REASSIGNED,
        metadata: { technicianId: 'tech_new', previousTechnicianId: 'tech_old' },
      }),
    );
  });

  // Documents CURRENT behaviour: assignTechnician does not consult the state
  // machine, so an IN_PROGRESS booking is forced back to ASSIGNED.
  it('currently forces IN_PROGRESS back to ASSIGNED (bypasses canTransitionBooking)', async () => {
    const { svc, repo, prisma } = buildService(
      makeBooking({ status: S.IN_PROGRESS, technicianId: 'tech_old' }),
    );
    prisma.client.technician.findFirst.mockResolvedValue({
      id: 'tech_new',
      skills: ['AC_REPAIR'],
      status: 'AVAILABLE',
    });
    expect(canTransitionBooking(S.IN_PROGRESS, S.ASSIGNED)).toBe(false);
    await svc.assignTechnician(actor, 'book_1', { technicianId: 'tech_new' });
    expect(repo.update.mock.calls[0]![1]).toEqual(expect.objectContaining({ status: S.ASSIGNED }));
  });
});
