import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityType,
  BookingStatus,
  canTransitionBooking,
  DomainEventName,
  TERMINAL_BOOKING_STATUSES,
} from '@ac/types';

import { actor, buildService, makeBooking } from './bookings.test-helpers';

const S = BookingStatus;
const HOUR = 60 * 60 * 1000;

describe('BookingsService.reschedule', () => {
  const originalAt = new Date('2026-10-20T06:00:00.000Z');
  const newAtIso = '2026-10-21T09:30:00.000Z';

  beforeEach(() => jest.useFakeTimers({ now: new Date('2026-10-16T08:00:00.000Z') }));
  afterEach(() => jest.useRealTimers());

  it('throws NotFound for an unknown booking', async () => {
    const { svc } = buildService(null);
    await expect(
      svc.reschedule(actor, 'nope', { scheduledAt: newAtIso }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([...TERMINAL_BOOKING_STATUSES])('refuses to reschedule a %s booking', async (status) => {
    const { svc, repo, events } = buildService(makeBooking({ status, scheduledAt: originalAt }));
    const p = svc.reschedule(actor, 'book_1', { scheduledAt: newAtIso });
    await expect(p).rejects.toBeInstanceOf(ForbiddenException);
    await expect(p).rejects.toThrow('Cannot reschedule a closed booking');
    expect(repo.update).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('rejects a time more than 60s in the past', async () => {
    const { svc, repo } = buildService(makeBooking({ scheduledAt: originalAt }));
    const past = new Date(Date.now() - 61 * 1000).toISOString();
    await expect(svc.reschedule(actor, 'book_1', { scheduledAt: past })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('tolerates up to 60s of clock skew', async () => {
    const { svc, repo } = buildService(makeBooking({ scheduledAt: originalAt }));
    const slightlyPast = new Date(Date.now() - 30 * 1000).toISOString();
    await svc.reschedule(actor, 'book_1', { scheduledAt: slightlyPast });
    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  it('skips the conflict check when no technician is assigned', async () => {
    const { svc, repo } = buildService(makeBooking({ technicianId: null, scheduledAt: originalAt }));
    await svc.reschedule(actor, 'book_1', { scheduledAt: newAtIso });
    expect(repo.hasTechnicianConflict).not.toHaveBeenCalled();
  });

  it('checks the assigned technician for conflicts at the new time, excluding itself', async () => {
    const { svc, repo } = buildService(
      makeBooking({ status: S.ASSIGNED, technicianId: 'tech_1', scheduledAt: originalAt }),
    );
    await svc.reschedule(actor, 'book_1', { scheduledAt: newAtIso });
    expect(repo.hasTechnicianConflict).toHaveBeenCalledWith({
      technicianId: 'tech_1',
      scheduledAt: new Date(newAtIso),
      excludeBookingId: 'book_1',
    });
  });

  it('rejects with Conflict when the technician is busy at the new time', async () => {
    const { svc, repo, events } = buildService(
      makeBooking({ status: S.ASSIGNED, technicianId: 'tech_1', scheduledAt: originalAt }),
    );
    repo.hasTechnicianConflict.mockResolvedValue(true);
    await expect(
      svc.reschedule(actor, 'book_1', { scheduledAt: newAtIso }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.update).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('writes new time, previous time, increments rescheduleCount', async () => {
    const { svc, repo, tx } = buildService(
      makeBooking({ status: S.PENDING, scheduledAt: originalAt, scheduledTimeSlot: '10:00-12:00' }),
    );
    await svc.reschedule(actor, 'book_1', {
      scheduledAt: newAtIso,
      scheduledTimeSlot: '14:00-16:00',
    });
    expect(repo.update).toHaveBeenCalledWith(
      'book_1',
      expect.objectContaining({
        scheduledAt: new Date(newAtIso),
        scheduledTimeSlot: '14:00-16:00',
        rescheduledFromAt: originalAt,
        rescheduleCount: { increment: 1 },
        updatedBy: 'user_1',
      }),
      tx,
    );
  });

  it('keeps the existing time slot when none is supplied', async () => {
    const { svc, repo } = buildService(
      makeBooking({ scheduledAt: originalAt, scheduledTimeSlot: '10:00-12:00' }),
    );
    await svc.reschedule(actor, 'book_1', { scheduledAt: newAtIso });
    expect(repo.update.mock.calls[0]![1]).toEqual(
      expect.objectContaining({ scheduledTimeSlot: '10:00-12:00' }),
    );
  });

  describe('resulting status', () => {
    it.each([S.PENDING, S.CONFIRMED])('keeps %s as-is', async (status) => {
      const { svc, repo } = buildService(makeBooking({ status, scheduledAt: originalAt }));
      const row = await svc.reschedule(actor, 'book_1', { scheduledAt: newAtIso });
      expect(repo.update.mock.calls[0]![1]).toEqual(expect.objectContaining({ status }));
      expect(row).toEqual(expect.objectContaining({ status }));
    });

    it.each([S.ASSIGNED, S.RESCHEDULED, S.DRAFT, S.TECHNICIAN_EN_ROUTE, S.IN_PROGRESS, S.WAITING_PARTS])(
      'moves %s to RESCHEDULED',
      async (status) => {
        const { svc, repo } = buildService(makeBooking({ status, scheduledAt: originalAt }));
        await svc.reschedule(actor, 'book_1', { scheduledAt: newAtIso });
        expect(repo.update.mock.calls[0]![1]).toEqual(
          expect.objectContaining({ status: S.RESCHEDULED }),
        );
      },
    );

    // Documents CURRENT behaviour: reschedule does not consult the state
    // machine, so it can produce transitions the table forbids.
    it.each([S.DRAFT, S.TECHNICIAN_EN_ROUTE, S.IN_PROGRESS, S.WAITING_PARTS])(
      'currently bypasses the state machine for %s -> RESCHEDULED',
      (status) => {
        expect(canTransitionBooking(status, S.RESCHEDULED)).toBe(false);
      },
    );
  });

  it('records a RESCHEDULED activity with from/to ISO timestamps', async () => {
    const { svc, activity, tx } = buildService(
      makeBooking({ status: S.ASSIGNED, technicianId: 'tech_1', scheduledAt: originalAt }),
    );
    await svc.reschedule(actor, 'book_1', { scheduledAt: newAtIso, reason: 'Customer request' });
    expect(activity.recordBookingActivity).toHaveBeenCalledWith(
      'book_1',
      expect.objectContaining({
        type: ActivityType.RESCHEDULED,
        actorUserId: 'user_1',
        fromStatus: S.ASSIGNED,
        toStatus: S.RESCHEDULED,
        message: 'Customer request',
        metadata: { from: originalAt.toISOString(), to: newAtIso },
      }),
      tx,
    );
  });

  it('publishes BookingRescheduled', async () => {
    const { svc, events } = buildService(makeBooking({ scheduledAt: originalAt }));
    await svc.reschedule(actor, 'book_1', { scheduledAt: newAtIso });
    expect(events.publish).toHaveBeenCalledTimes(1);
    expect(events.publish).toHaveBeenCalledWith(DomainEventName.BookingRescheduled, {
      bookingId: 'book_1',
      fromAt: originalAt.toISOString(),
      toAt: newAtIso,
      reason: null,
    });
  });

  it('allows rescheduling within the 2h window of the original slot', async () => {
    const { svc, repo } = buildService(
      makeBooking({ status: S.ASSIGNED, technicianId: 'tech_1', scheduledAt: originalAt }),
    );
    const near = new Date(originalAt.getTime() + HOUR).toISOString();
    await svc.reschedule(actor, 'book_1', { scheduledAt: near });
    // The booking itself is excluded from the conflict query.
    expect(repo.hasTechnicianConflict.mock.calls[0]![0]).toEqual(
      expect.objectContaining({ excludeBookingId: 'book_1' }),
    );
    expect(repo.update).toHaveBeenCalledTimes(1);
  });
});
