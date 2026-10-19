import { BookingStatus } from '@ac/types';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { signRatingToken } from '../../../common/links/rating-link';
import { PublicRatingsService } from '../public-ratings.service';

const SECRET = 'test-secret-that-is-long-enough-000000';

function booking(o: Record<string, unknown> = {}) {
  return {
    id: 'bk_1',
    tenantId: 't1',
    customerId: 'c1',
    technicianId: 'tech_1',
    code: 'ACB-2026-000001',
    status: BookingStatus.COMPLETED,
    category: 'AC_REPAIR',
    serviceType: null,
    completedAt: new Date('2026-10-17T10:00:00Z'),
    technician: { fullName: 'Prakash  Shetty' },
    rating: null,
    ...o,
  };
}

function build(row: Record<string, unknown> | null) {
  const prisma = {
    client: {
      booking: { findFirst: jest.fn().mockResolvedValue(row) },
      bookingRating: { create: jest.fn().mockResolvedValue({ id: 'r1' }) },
    },
  };
  const bookings = { recomputeTechnicianRating: jest.fn().mockResolvedValue(4.5) };
  const svc = new PublicRatingsService(prisma as never, bookings as never, { JWT_SECRET: SECRET } as never);
  return { svc, prisma, bookings, token: signRatingToken(SECRET, 'bk_1') };
}

describe('PublicRatingsService', () => {
  it('404s on a forged or unknown token without touching the database', async () => {
    const { svc, prisma } = build(booking());
    await expect(svc.view('bad.token')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.client.booking.findFirst).not.toHaveBeenCalled();
  });

  it('shows a summary without customer details', async () => {
    const { svc, token, prisma } = build(booking());
    await expect(svc.view(token)).resolves.toEqual({
      bookingCode: 'ACB-2026-000001',
      service: 'AC repair',
      completedAt: '2026-10-17T10:00:00.000Z',
      technicianFirstName: 'Prakash',
      rated: false,
      canRate: true,
    });
    expect(prisma.client.booking.findFirst.mock.calls[0][0].where).toEqual({ id: 'bk_1', deletedAt: null });
  });

  it('records the rating against the booking and refreshes the technician average', async () => {
    const { svc, token, prisma, bookings } = build(booking());
    await svc.rate(token, { value: 5, comment: '  Quick and tidy ' });
    expect(prisma.client.bookingRating.create.mock.calls[0][0].data).toMatchObject({
      tenantId: 't1',
      bookingId: 'bk_1',
      customerId: 'c1',
      technicianId: 'tech_1',
      value: 5,
      comment: 'Quick and tidy',
      photos: [],
    });
    expect(bookings.recomputeTechnicianRating).toHaveBeenCalledWith('t1', 'tech_1');
  });

  it('refuses visits that are not completed or already rated', async () => {
    const open = build(booking({ status: BookingStatus.IN_PROGRESS }));
    await expect(open.svc.rate(open.token, { value: 4 })).rejects.toBeInstanceOf(BadRequestException);
    const rated = build(booking({ rating: { id: 'r0' } }));
    await expect(rated.svc.rate(rated.token, { value: 4 })).rejects.toBeInstanceOf(ConflictException);
    expect(rated.prisma.client.bookingRating.create).not.toHaveBeenCalled();
  });
});
