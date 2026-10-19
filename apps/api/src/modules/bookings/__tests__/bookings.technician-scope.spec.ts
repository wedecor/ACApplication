import { BookingStatus } from '@ac/types';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { assertTechnicianTransition } from '../bookings.service';
import { actor, buildService, makeBooking } from './bookings.test-helpers';

const tech = { ...actor, userId: 'user_tech', roles: ['TECHNICIAN'] } as typeof actor;
const S = BookingStatus;

function forTech(booking = makeBooking({ technicianId: 'tech_1', status: S.TECHNICIAN_EN_ROUTE })) {
  const ctx = buildService(booking);
  ctx.prisma.client.technician.findFirst.mockResolvedValue({ id: 'tech_1' });
  return ctx;
}

describe('BookingsService — field technician scope', () => {
  it('forces the list filter to the technician’s own assignments', async () => {
    const { svc, repo } = forTech();
    const query = { technicianId: 'someone_else', page: 1, pageSize: 20 } as never;
    await svc.list(tech, query);
    expect(repo.list.mock.calls[0][1]).toMatchObject({ technicianId: 'tech_1' });
  });

  it('404s on a booking assigned to another technician', async () => {
    const { svc } = forTech(makeBooking({ technicianId: 'tech_2' }));
    await expect(svc.getById(tech, 'book_1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('also guards notes, attachments and activity reads', async () => {
    const { svc, activity } = forTech(makeBooking({ technicianId: 'tech_2' }));
    await expect(svc.listNotes(tech, 'book_1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.listAttachments(tech, 'book_1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.listActivities(tech, 'book_1')).rejects.toBeInstanceOf(NotFoundException);
    expect(activity.listBookingActivities).not.toHaveBeenCalled();
  });

  it('refuses booking edits from technicians', async () => {
    const { svc } = forTech();
    await expect(svc.update(tech, 'book_1', {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('cannot start work through the status endpoint before the arrival OTP', async () => {
    const { svc, repo } = forTech();
    await expect(svc.changeStatus(tech, 'book_1', { status: S.IN_PROGRESS })).rejects.toThrow(/arrival OTP/);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('leaves staff unrestricted', async () => {
    const { svc, prisma } = buildService(makeBooking({ technicianId: 'tech_2' }));
    await expect(svc.getById(actor, 'book_1')).resolves.toMatchObject({ id: 'book_1' });
    expect(prisma.client.technician.findFirst).not.toHaveBeenCalled();
  });
});

describe('assertTechnicianTransition', () => {
  it('blocks cancel and no-show for technicians', () => {
    expect(() => assertTechnicianTransition({ status: S.ASSIGNED, otpVerifiedAt: null }, S.CANCELLED)).toThrow(ForbiddenException);
    expect(() => assertTechnicianTransition({ status: S.ASSIGNED, otpVerifiedAt: null }, S.NO_SHOW)).toThrow(ForbiddenException);
  });

  it('allows resuming work once the OTP was verified', () => {
    expect(() => assertTechnicianTransition({ status: S.WAITING_PARTS, otpVerifiedAt: new Date() }, S.IN_PROGRESS)).not.toThrow();
    expect(() => assertTechnicianTransition({ status: S.IN_PROGRESS, otpVerifiedAt: null }, S.COMPLETED)).not.toThrow();
  });
});
