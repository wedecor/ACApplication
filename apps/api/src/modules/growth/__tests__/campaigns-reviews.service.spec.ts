import { verifyRatingToken } from '../../../common/links/rating-link';
import { CampaignsService } from '../campaigns.service';
import type { GrowthConfig } from '../growth.config';
import { ReviewsService } from '../reviews.service';

const config: GrowthConfig = {
  referralRewardMinor: 0,
  referralRewardPoints: 0,
  loyaltyPointsPer100: 1,
  reviewRequestDelayMinutes: 60,
  reviewRequestChannel: 'WHATSAPP',
  googleReviewUrl: 'https://g.page/r/review',
  schedulerDisabled: true,
};

describe('CampaignsService.dispatch', () => {
  function build() {
    const prisma = {
      client: {
        campaign: {
          findUnique: jest.fn(),
          update: jest.fn().mockResolvedValue({}),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    };
    const members = [
      { id: 'c1', userId: 'u1', fullName: 'A', phone: '+911', email: null, preferences: {}, preferredLanguage: 'en' },
      { id: 'c2', userId: 'u2', fullName: 'B', phone: '+912', email: null, preferences: { marketingOptOut: true }, preferredLanguage: 'en' },
      { id: 'c3', userId: 'u3', fullName: 'C', phone: '+913', email: null, preferences: {}, preferredLanguage: 'hi' },
    ];
    const segments = {
      iterateMembers: jest.fn(async function* () {
        yield members;
      }),
    };
    const notifications = { enqueue: jest.fn().mockResolvedValue(['n']) };
    const service = new CampaignsService(prisma as never, segments as never, notifications as never);
    return { service, prisma: prisma.client, notifications };
  }

  it('enqueues per member, skipping opt-outs and counting failures', async () => {
    const { service, prisma, notifications } = build();
    prisma.campaign.findUnique
      .mockResolvedValueOnce({
        id: 'cmp', tenantId: 't1', channel: 'SMS', templateKey: 'growth.campaign', message: 'Hi',
        segment: { rules: {} }, coupon: { code: 'SAVE10' },
      })
      .mockResolvedValue({ status: 'RUNNING' });
    notifications.enqueue.mockResolvedValueOnce(['n1']).mockRejectedValueOnce(new Error('rate limited'));

    const stats = await service.dispatch('cmp');
    expect(stats).toEqual({ targeted: 3, sent: 1, failed: 1, skippedOptOut: 1, converted: 0 });
    expect(notifications.enqueue).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ userId: 'u1' }),
      ['SMS'],
      expect.objectContaining({ idempotencyKey: 'campaign:cmp:c1', data: expect.objectContaining({ couponCode: 'SAVE10' }) }),
      expect.anything(),
    );
    expect(prisma.campaign.update).toHaveBeenLastCalledWith({
      where: { id: 'cmp' },
      data: expect.objectContaining({ status: 'COMPLETED' }),
    });
  });

  it('stops when the campaign was cancelled mid-flight', async () => {
    const { service, prisma, notifications } = build();
    prisma.campaign.findUnique
      .mockResolvedValueOnce({ id: 'cmp', tenantId: 't1', channel: 'SMS', templateKey: 'k', message: null, segment: { rules: {} }, coupon: null })
      .mockResolvedValue({ status: 'CANCELLED' });
    await service.dispatch('cmp');
    expect(notifications.enqueue).not.toHaveBeenCalled();
    const last = prisma.campaign.update.mock.calls.at(-1)?.[0] as { data: Record<string, unknown> };
    expect(last.data.status).toBeUndefined();
  });

  it('runDue claims scheduled campaigns before dispatching', async () => {
    const { service, prisma } = build();
    prisma.campaign.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    prisma.campaign.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const spy = jest.spyOn(service, 'dispatch').mockResolvedValue({ targeted: 0, sent: 0, failed: 0, skippedOptOut: 0, converted: 0 });
    await expect(service.runDue()).resolves.toBe(1);
    expect(spy).toHaveBeenCalledWith('a');
    expect(spy).not.toHaveBeenCalledWith('b');
  });
});

describe('ReviewsService', () => {
  function build() {
    const prisma = {
      client: {
        booking: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn().mockResolvedValue({}) },
        bookingRating: {
          update: jest.fn().mockResolvedValue({}),
          findMany: jest.fn(),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          aggregate: jest.fn(),
          count: jest.fn(),
        },
        notification: { count: jest.fn() },
      },
    };
    const notifications = { enqueue: jest.fn().mockResolvedValue(['n']) };
    const service = new ReviewsService(prisma as never, notifications as never, config, { WEB_URL: 'https://w.test', JWT_SECRET: 'test-secret-that-is-long-enough-000000' } as never);
    return { service, prisma: prisma.client, notifications };
  }

  const now = new Date('2026-06-01T12:00:00Z');
  const customer = { userId: 'u1', fullName: 'A', phone: '+911', email: null, preferences: {} };

  it('stamps a due time when a booking completes', async () => {
    const { service, prisma } = build();
    prisma.booking.findUnique.mockResolvedValue({ id: 'b1', status: 'COMPLETED', metadata: { x: 1 } });
    await service.onBookingCompleted('b1', now);
    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { metadata: { x: 1, reviewRequestDueAt: '2026-06-01T13:00:00.000Z' } },
    });
  });

  it('sends due review requests once and skips not-yet-due / already-rated bookings', async () => {
    const { service, prisma, notifications } = build();
    prisma.booking.findMany.mockResolvedValue([
      { id: 'due', tenantId: 't1', code: 'B-1', metadata: { reviewRequestDueAt: '2026-06-01T11:00:00Z' }, rating: null, customer },
      { id: 'later', tenantId: 't1', code: 'B-2', metadata: { reviewRequestDueAt: '2026-06-01T13:00:00Z' }, rating: null, customer },
      { id: 'sent', tenantId: 't1', code: 'B-3', metadata: { reviewRequestDueAt: '2026-06-01T10:00:00Z', reviewRequestedAt: 'x' }, rating: null, customer },
      { id: 'rated', tenantId: 't1', code: 'B-4', metadata: { reviewRequestDueAt: '2026-06-01T10:00:00Z' }, rating: { id: 'r4', reviewRequestedAt: null }, customer },
    ]);
    await expect(service.sweepReviewRequests(now)).resolves.toBe(1);
    expect(notifications.enqueue).toHaveBeenCalledTimes(1);
    expect(notifications.enqueue).toHaveBeenCalledWith(
      't1',
      expect.anything(),
      ['WHATSAPP'],
      expect.objectContaining({ template: 'growth.review_request', idempotencyKey: 'review-request:due' }),
    );
    expect(prisma.bookingRating.update).toHaveBeenCalledWith({ where: { id: 'r4' }, data: { reviewRequestedAt: now } });
    // The link is a signed token for the website's rating page, not a raw booking id.
    const rateUrl = (notifications.enqueue.mock.calls[0][3] as { data: { rateUrl: string } }).data.rateUrl;
    expect(rateUrl).toMatch(/^https:\/\/w\.test\/rate\/[\w-]+\.[\w-]{22}$/);
    expect(verifyRatingToken('test-secret-that-is-long-enough-000000', rateUrl.split('/rate/')[1]!)).toBe('due');
  });

  it('follows up 4–5 star ratings with the Google review link', async () => {
    const { service, prisma, notifications } = build();
    prisma.bookingRating.findMany.mockResolvedValue([{ id: 'r1', tenantId: 't1', bookingId: 'b1', customer }]);
    await expect(service.sweepPublicReviewFollowUps(now)).resolves.toBe(1);
    expect(prisma.bookingRating.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ value: { gte: 4 }, publicReviewUrl: null }) }),
    );
    expect(notifications.enqueue).toHaveBeenCalledWith(
      't1', expect.anything(), ['WHATSAPP'],
      expect.objectContaining({ template: 'growth.google_review', data: expect.objectContaining({ reviewUrl: 'https://g.page/r/review' }) }),
    );
  });

  it('summarises NPS', async () => {
    const { service, prisma } = build();
    prisma.bookingRating.findMany.mockResolvedValue([{ npsScore: 10 }, { npsScore: 9 }, { npsScore: 3 }, { npsScore: 8 }]);
    prisma.bookingRating.aggregate.mockResolvedValue({ _avg: { value: 4.333 }, _count: { _all: 6 } });
    prisma.notification.count.mockResolvedValue(10);
    prisma.bookingRating.count.mockResolvedValue(2);
    await expect(service.npsSummary('t1')).resolves.toEqual({
      total: 4, promoters: 2, passives: 1, detractors: 1, score: 25,
      ratingsCount: 6, avgRating: 4.33, reviewRequests: 10, publicReviewLinksSent: 2,
    });
  });
});
