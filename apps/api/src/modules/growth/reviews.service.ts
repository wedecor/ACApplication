/**
 * Review / NPS automation.
 *
 *   BookingCompleted → stamp `booking.metadata.reviewRequestDueAt` (now + delay)
 *   sweepReviewRequests (cron) → send a WhatsApp/SMS asking for stars + NPS,
 *     stamp `booking.metadata.reviewRequestedAt` (and BookingRating.reviewRequestedAt
 *     if a rating already exists)
 *   sweepPublicReviewFollowUps (cron) → 4–5★ ratings get the Google review link;
 *     `BookingRating.publicReviewUrl` records that the link was sent.
 */
import type { LoadedServerEnv } from '@ac/config';
import type { Prisma } from '@ac/database';
import { BookingStatus } from '@ac/types';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { APP_CONFIG } from '../../common/config/config.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { GROWTH_CONFIG, type GrowthConfig } from './growth.config';
import { isOptedOut, summariseNps } from './growth.rules';

const HOUR_MS = 3_600_000;
const SWEEP_WINDOW_MS = 72 * HOUR_MS;

function meta(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};
}

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Inject(GROWTH_CONFIG) private readonly config: GrowthConfig,
    @Inject(APP_CONFIG) private readonly env: LoadedServerEnv,
  ) {}

  async onBookingCompleted(bookingId: string, now = new Date()): Promise<void> {
    const booking = await this.prisma.client.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, metadata: true, status: true },
    });
    if (booking?.status !== BookingStatus.COMPLETED) return;
    const m = meta(booking.metadata);
    if (m.reviewRequestDueAt || m.reviewRequestedAt) return;
    m.reviewRequestDueAt = new Date(now.getTime() + this.config.reviewRequestDelayMinutes * 60_000).toISOString();
    await this.prisma.client.booking.update({
      where: { id: booking.id },
      data: { metadata: m as Prisma.InputJsonValue },
    });
  }

  async sweepReviewRequests(now = new Date()): Promise<number> {
    const candidates = await this.prisma.client.booking.findMany({
      where: {
        status: BookingStatus.COMPLETED,
        deletedAt: null,
        completedAt: { gte: new Date(now.getTime() - SWEEP_WINDOW_MS) },
      },
      select: {
        id: true,
        tenantId: true,
        code: true,
        metadata: true,
        rating: { select: { id: true, reviewRequestedAt: true } },
        customer: { select: { userId: true, fullName: true, phone: true, email: true, preferences: true } },
      },
      orderBy: { completedAt: 'asc' },
      take: 500,
    });
    let sent = 0;
    for (const b of candidates) {
      const m = meta(b.metadata);
      const due = typeof m.reviewRequestDueAt === 'string' ? new Date(m.reviewRequestDueAt) : null;
      if (!due || m.reviewRequestedAt || due.getTime() > now.getTime()) continue;

      const channel = this.config.reviewRequestChannel;
      // Claim first so a crash never double-sends.
      m.reviewRequestedAt = now.toISOString();
      await this.prisma.client.booking.update({
        where: { id: b.id },
        data: { metadata: m as Prisma.InputJsonValue },
      });
      if (b.rating && !b.rating.reviewRequestedAt) {
        await this.prisma.client.bookingRating.update({
          where: { id: b.rating.id },
          data: { reviewRequestedAt: now },
        });
      }
      // Already rated in-app → no need to ask.
      if (b.rating) continue;
      if (isOptedOut(b.customer.preferences, channel, 'transactional')) continue;
      try {
        await this.notifications.enqueue(
          b.tenantId,
          { userId: b.customer.userId, phone: b.customer.phone ?? undefined, email: b.customer.email ?? undefined },
          [channel],
          {
            template: 'growth.review_request',
            data: {
              customerName: b.customer.fullName,
              bookingCode: b.code,
              rateUrl: `${this.env.WEB_URL.replace(/\/+$/, '')}/bookings/${b.id}/rate`,
            },
            idempotencyKey: `review-request:${b.id}`,
          },
        );
        sent += 1;
      } catch (err) {
        this.logger.warn({ bookingId: b.id, reason: (err as Error).message }, 'Review request enqueue failed');
      }
    }
    return sent;
  }

  async sweepPublicReviewFollowUps(now = new Date()): Promise<number> {
    const url = this.config.googleReviewUrl;
    if (!url) return 0;
    const ratings = await this.prisma.client.bookingRating.findMany({
      where: {
        value: { gte: 4 },
        publicReviewUrl: null,
        deletedAt: null,
        createdAt: { gte: new Date(now.getTime() - SWEEP_WINDOW_MS) },
      },
      select: {
        id: true,
        tenantId: true,
        bookingId: true,
        customer: { select: { userId: true, fullName: true, phone: true, email: true, preferences: true } },
      },
      take: 200,
    });
    let sent = 0;
    for (const r of ratings) {
      const claimed = await this.prisma.client.bookingRating.updateMany({
        where: { id: r.id, publicReviewUrl: null },
        data: { publicReviewUrl: url },
      });
      if (claimed.count === 0) continue;
      const channel = this.config.reviewRequestChannel;
      if (isOptedOut(r.customer.preferences, channel, 'transactional')) continue;
      try {
        await this.notifications.enqueue(
          r.tenantId,
          { userId: r.customer.userId, phone: r.customer.phone ?? undefined, email: r.customer.email ?? undefined },
          [channel],
          {
            template: 'growth.google_review',
            data: { customerName: r.customer.fullName, reviewUrl: url },
            idempotencyKey: `google-review:${r.bookingId}`,
          },
        );
        sent += 1;
      } catch (err) {
        this.logger.warn({ ratingId: r.id, reason: (err as Error).message }, 'Google review follow-up failed');
      }
    }
    return sent;
  }

  async npsSummary(tenantId: string, from?: string, to?: string) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (from) createdAt.gte = new Date(from);
    if (to) createdAt.lte = new Date(to);
    const where: Prisma.BookingRatingWhereInput = {
      tenantId,
      deletedAt: null,
      ...(from || to ? { createdAt } : {}),
    };
    const [npsRows, agg, reviewRequests, publicReviewLinksSent] = await Promise.all([
      this.prisma.client.bookingRating.findMany({
        where: { ...where, npsScore: { not: null } },
        select: { npsScore: true },
      }),
      this.prisma.client.bookingRating.aggregate({ where, _avg: { value: true }, _count: { _all: true } }),
      this.prisma.client.notification.count({
        where: {
          tenantId,
          template: 'growth.review_request',
          ...(from || to ? { createdAt } : {}),
        },
      }),
      this.prisma.client.bookingRating.count({ where: { ...where, publicReviewUrl: { not: null } } }),
    ]);
    const nps = summariseNps(npsRows.map((r) => r.npsScore!));
    return {
      ...nps,
      ratingsCount: agg._count._all,
      avgRating: agg._avg.value === null ? null : Math.round(agg._avg.value * 100) / 100,
      reviewRequests,
      publicReviewLinksSent,
    };
  }
}
