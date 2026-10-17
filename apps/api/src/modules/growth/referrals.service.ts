import type { LoadedServerEnv } from '@ac/config';
import type { Prisma } from '@ac/database';
import { BookingStatus, NotificationChannel } from '@ac/types';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { APP_CONFIG } from '../../common/config/config.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { ListReferralsDto, OverrideReferralDto } from './dto/growth.dto';
import { GROWTH_CONFIG, type GrowthConfig } from './growth.config';
import { generateReferralCode } from './growth.rules';
import { LoyaltyService } from './loyalty.service';

const MAX_CODE_ATTEMPTS = 6;

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
}

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly loyalty: LoyaltyService,
    private readonly notifications: NotificationsService,
    @Inject(GROWTH_CONFIG) private readonly config: GrowthConfig,
    @Inject(APP_CONFIG) private readonly env: LoadedServerEnv,
  ) {}

  /** Lazily create the customer's referral code (random, never derived from PII). */
  async ensureCode(tenantId: string, customerId: string) {
    const existing = await this.prisma.client.referralCode.findUnique({ where: { customerId } });
    if (existing && !existing.deletedAt) return existing;
    for (let i = 0; i < MAX_CODE_ATTEMPTS; i += 1) {
      const code = generateReferralCode();
      try {
        if (existing) {
          return await this.prisma.client.referralCode.update({
            where: { id: existing.id },
            data: { code, deletedAt: null },
          });
        }
        return await this.prisma.client.referralCode.create({ data: { tenantId, customerId, code } });
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        // customerId race → return the winner; code collision → retry.
        const winner = await this.prisma.client.referralCode.findUnique({ where: { customerId } });
        if (winner && !winner.deletedAt) return winner;
      }
    }
    throw new ConflictException('Could not allocate a referral code, please retry');
  }

  shareUrl(code: string): string {
    const base = this.env.WEB_URL.replace(/\/+$/, '');
    return `${base}/r/${encodeURIComponent(code)}`;
  }

  async summaryForCustomer(tenantId: string, customerId: string) {
    const code = await this.ensureCode(tenantId, customerId);
    const referrals = await this.prisma.client.referral.findMany({
      where: { tenantId, referrerCustomerId: customerId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { referred: { select: { fullName: true } } },
    });
    const rewarded = referrals.filter((r) => r.status === 'REWARDED');
    return {
      code: code.code,
      shareUrl: this.shareUrl(code.code),
      referredCount: referrals.length,
      rewardedCount: rewarded.length,
      totalRewardMinor: rewarded.reduce((s, r) => s + r.rewardMinor, 0),
      referrals: referrals.map((r) => ({
        id: r.id,
        status: r.status,
        rewardMinor: r.rewardMinor,
        createdAt: r.createdAt.toISOString(),
        referredName: maskName(r.referred.fullName),
      })),
    };
  }

  /** A new customer (no completed bookings) attaches a friend's referral code. */
  async apply(tenantId: string, customerId: string, rawCode: string): Promise<{ ok: true }> {
    const code = rawCode.trim().toUpperCase();
    const refCode = await this.prisma.client.referralCode.findFirst({
      where: { tenantId, code, deletedAt: null },
    });
    if (!refCode) throw new NotFoundException('Referral code not found');
    if (refCode.customerId === customerId) {
      throw new BadRequestException('You cannot use your own referral code');
    }
    const [completed, already] = await Promise.all([
      this.prisma.client.booking.count({
        where: { tenantId, customerId, status: BookingStatus.COMPLETED, deletedAt: null },
      }),
      this.prisma.client.referral.findUnique({ where: { referredCustomerId: customerId } }),
    ]);
    if (completed > 0) {
      throw new UnprocessableEntityException('Referral codes can only be used before your first completed booking');
    }
    if (already) throw new ConflictException('A referral code has already been applied');
    // Block A↔B loops: the referrer must not have been referred by this customer.
    const loop = await this.prisma.client.referral.findFirst({
      where: { referrerCustomerId: customerId, referredCustomerId: refCode.customerId },
      select: { id: true },
    });
    if (loop) throw new BadRequestException('Referral code cannot be applied');
    try {
      await this.prisma.client.referral.create({
        data: {
          tenantId,
          referralCodeId: refCode.id,
          referrerCustomerId: refCode.customerId,
          referredCustomerId: customerId,
          rewardMinor: this.config.referralRewardMinor,
        },
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException('A referral code has already been applied');
      throw err;
    }
    return { ok: true };
  }

  /**
   * Called on BookingCompleted: if this was the referred customer's first
   * completed booking, PENDING → QUALIFIED → REWARDED and credit the referrer.
   */
  async onBookingCompleted(bookingId: string): Promise<'rewarded' | 'skipped'> {
    const booking = await this.prisma.client.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, tenantId: true, customerId: true, status: true },
    });
    if (booking?.status !== BookingStatus.COMPLETED) return 'skipped';
    const referral = await this.prisma.client.referral.findUnique({
      where: { referredCustomerId: booking.customerId },
    });
    if (referral?.status !== 'PENDING' || referral.deletedAt) return 'skipped';
    const completed = await this.prisma.client.booking.count({
      where: { customerId: booking.customerId, status: BookingStatus.COMPLETED, deletedAt: null },
    });
    if (completed !== 1) return 'skipped';

    const claimed = await this.prisma.client.referral.updateMany({
      where: { id: referral.id, status: 'PENDING' },
      data: { status: 'QUALIFIED', qualifiedAt: new Date(), qualifiedBookingId: booking.id },
    });
    if (claimed.count === 0) return 'skipped';
    await this.reward(referral.id);
    return 'rewarded';
  }

  /** QUALIFIED → REWARDED with a loyalty credit to the referrer (idempotent). */
  private async reward(referralId: string): Promise<void> {
    const referral = await this.prisma.client.$transaction(async (tx) => {
      const row = await tx.referral.findUnique({ where: { id: referralId } });
      if (!row || row.status === 'REWARDED') return null;
      await this.loyalty.post(
        {
          tenantId: row.tenantId,
          customerId: row.referrerCustomerId,
          points: this.config.referralRewardPoints,
          reason: 'Referral reward',
          refType: 'referral',
          refId: row.id,
        },
        tx,
      );
      return tx.referral.update({
        where: { id: row.id },
        data: { status: 'REWARDED', rewardedAt: new Date() },
        include: { referrer: { select: { userId: true, phone: true, email: true } } },
      });
    });
    if (!referral) return;
    try {
      await this.notifications.enqueue(
        referral.tenantId,
        {
          userId: referral.referrer.userId,
          phone: referral.referrer.phone ?? undefined,
          email: referral.referrer.email ?? undefined,
        },
        [NotificationChannel.PUSH, NotificationChannel.IN_APP],
        {
          template: 'growth.referral_rewarded',
          data: { points: this.config.referralRewardPoints, rewardMinor: referral.rewardMinor },
          idempotencyKey: `referral-reward:${referral.id}`,
        },
      );
    } catch (err) {
      this.logger.warn({ err, referralId }, 'Referral reward notification failed');
    }
  }

  // ------------------------------------------------------------------ admin
  async list(tenantId: string, q: ListReferralsDto) {
    const where: Prisma.ReferralWhereInput = {
      tenantId,
      deletedAt: null,
      ...(q.status ? { status: q.status } : {}),
      ...(q.search
        ? {
            OR: [
              { referralCode: { code: { contains: q.search.toUpperCase() } } },
              { referrer: { fullName: { contains: q.search, mode: 'insensitive' } } },
              { referred: { fullName: { contains: q.search, mode: 'insensitive' } } },
              { referrer: { phone: { contains: q.search } } },
              { referred: { phone: { contains: q.search } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.client.referral.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.pageSize,
        include: {
          referralCode: { select: { code: true } },
          referrer: { select: { id: true, fullName: true, phone: true } },
          referred: { select: { id: true, fullName: true, phone: true } },
        },
      }),
      this.prisma.client.referral.count({ where }),
    ]);
    const items = rows.map((r) => ({
      id: r.id,
      status: r.status,
      rewardMinor: r.rewardMinor,
      code: r.referralCode.code,
      createdAt: r.createdAt.toISOString(),
      qualifiedAt: r.qualifiedAt?.toISOString() ?? null,
      rewardedAt: r.rewardedAt?.toISOString() ?? null,
      qualifiedBookingId: r.qualifiedBookingId,
      referrer: r.referrer,
      referred: r.referred,
    }));
    return { items, total };
  }

  async stats(tenantId: string) {
    const groups = await this.prisma.client.referral.groupBy({
      by: ['status'],
      where: { tenantId, deletedAt: null },
      _count: { _all: true },
      _sum: { rewardMinor: true },
    });
    const by = (s: string) => groups.find((g) => g.status === s);
    return {
      total: groups.reduce((s, g) => s + g._count._all, 0),
      pending: by('PENDING')?._count._all ?? 0,
      qualified: by('QUALIFIED')?._count._all ?? 0,
      rewarded: by('REWARDED')?._count._all ?? 0,
      rejected: by('REJECTED')?._count._all ?? 0,
      totalRewardMinor: by('REWARDED')?._sum.rewardMinor ?? 0,
    };
  }

  async override(tenantId: string, id: string, dto: OverrideReferralDto) {
    const row = await this.prisma.client.referral.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!row) throw new NotFoundException('Referral not found');
    if (row.status === 'REWARDED' && dto.status !== 'REWARDED') {
      throw new ConflictException('Referral already rewarded; reverse the loyalty credit manually first');
    }
    const data: Prisma.ReferralUpdateInput = {};
    if (dto.rewardMinor !== undefined) data.rewardMinor = dto.rewardMinor;
    if (dto.status !== 'REWARDED') {
      data.status = dto.status;
      if (dto.status === 'QUALIFIED' && !row.qualifiedAt) data.qualifiedAt = new Date();
    } else if (row.status !== 'REWARDED' && !row.qualifiedAt) {
      data.qualifiedAt = new Date();
    }
    if (Object.keys(data).length > 0) await this.prisma.client.referral.update({ where: { id }, data });
    if (dto.status === 'REWARDED' && row.status !== 'REWARDED') await this.reward(id);
    return this.prisma.client.referral.findUnique({
      where: { id },
      include: {
        referralCode: { select: { code: true } },
        referrer: { select: { id: true, fullName: true, phone: true } },
        referred: { select: { id: true, fullName: true, phone: true } },
      },
    });
  }
}

/** "Priya Sharma" → "Priya S." — referrers see who joined without full PII. */
export function maskName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Friend';
  const first = parts[0]!;
  const last = parts.length > 1 ? ` ${parts[parts.length - 1]![0]!.toUpperCase()}.` : '';
  return `${first}${last}`;
}
