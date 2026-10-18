import type { LoadedServerEnv } from '@ac/config';
import { BookingStatus } from '@ac/types';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { APP_CONFIG } from '../../common/config/config.module';
import { verifyRatingToken } from '../../common/links/rating-link';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { PublicRateBookingDto } from './dto/public-rating.dto';
import { MeBookingsService } from './me-bookings.service';

export interface PublicRatingView {
  bookingCode: string;
  service: string;
  completedAt: string | null;
  technicianFirstName: string | null;
  /** True once the visit has a rating (from this page or the app). */
  rated: boolean;
  /** Whether the rating form should be offered. */
  canRate: boolean;
}

/**
 * The "rate your visit" page linked from review requests. The signed token is
 * the credential; it identifies one booking and nothing else.
 */
@Injectable()
export class PublicRatingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookings: MeBookingsService,
    @Inject(APP_CONFIG) private readonly env: LoadedServerEnv,
  ) {}

  async view(token: string): Promise<PublicRatingView> {
    const booking = await this.load(token);
    return {
      bookingCode: booking.code,
      service: booking.serviceType ?? humanize(booking.category),
      completedAt: booking.completedAt?.toISOString() ?? null,
      technicianFirstName: booking.technician?.fullName.trim().split(/\s+/)[0] ?? null,
      rated: booking.rating !== null,
      canRate: booking.status === BookingStatus.COMPLETED && booking.rating === null,
    };
  }

  async rate(token: string, dto: PublicRateBookingDto): Promise<{ ok: true }> {
    const booking = await this.load(token);
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException('Only completed visits can be rated');
    }
    if (booking.rating) throw new ConflictException('This visit has already been rated');
    try {
      await this.prisma.client.bookingRating.create({
        data: {
          tenantId: booking.tenantId,
          bookingId: booking.id,
          customerId: booking.customerId,
          technicianId: booking.technicianId,
          value: dto.value,
          npsScore: dto.npsScore ?? null,
          comment: dto.comment?.trim() || null,
          photos: [],
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        throw new ConflictException('This visit has already been rated');
      }
      throw err;
    }
    if (booking.technicianId) {
      await this.bookings.recomputeTechnicianRating(booking.tenantId, booking.technicianId);
    }
    return { ok: true };
  }

  private async load(token: string) {
    const bookingId = verifyRatingToken(this.env.JWT_SECRET, token);
    if (!bookingId) throw new NotFoundException('This rating link is not valid');
    const booking = await this.prisma.client.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      select: {
        id: true,
        tenantId: true,
        customerId: true,
        technicianId: true,
        code: true,
        status: true,
        category: true,
        serviceType: true,
        completedAt: true,
        technician: { select: { fullName: true } },
        rating: { select: { id: true } },
      },
    });
    if (!booking) throw new NotFoundException('This rating link is not valid');
    return booking;
  }
}

const ACRONYMS = new Set(['ac', 'ro', 'tv', 'led']);

/** `AC_SERVICING` → "AC servicing". */
function humanize(category: string): string {
  const words = category
    .toLowerCase()
    .split('_')
    .map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w));
  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
