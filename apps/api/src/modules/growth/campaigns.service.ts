import type { AuthPrincipal } from '@ac/auth';
import type { Prisma } from '@ac/database';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { CreateCampaignDto, ListCampaignsDto, UpdateCampaignDto } from './dto/growth.dto';
import { isOptedOut } from './growth.rules';
import { SegmentsService } from './segments.service';

export interface CampaignStats {
  targeted: number;
  sent: number;
  failed: number;
  skippedOptOut: number;
  converted: number;
}

const EDITABLE = new Set(['DRAFT', 'SCHEDULED']);
const CAMPAIGN_INCLUDE = {
  segment: { select: { id: true, name: true, memberCount: true } },
  coupon: { select: { id: true, code: true } },
} satisfies Prisma.CampaignInclude;

export function emptyStats(): CampaignStats {
  return { targeted: 0, sent: 0, failed: 0, skippedOptOut: 0, converted: 0 };
}

function readStats(raw: unknown): CampaignStats {
  const s = raw && typeof raw === 'object' ? (raw as Partial<CampaignStats>) : {};
  return { ...emptyStats(), ...s };
}

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly segments: SegmentsService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(actor: AuthPrincipal, q: ListCampaignsDto) {
    const where: Prisma.CampaignWhereInput = {
      tenantId: actor.tenantId,
      deletedAt: null,
      ...(q.status ? { status: q.status } : {}),
      ...(q.search ? { name: { contains: q.search, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.pageSize,
        include: CAMPAIGN_INCLUDE,
      }),
      this.prisma.client.campaign.count({ where }),
    ]);
    return { items, total };
  }

  async get(actor: AuthPrincipal, id: string) {
    const row = await this.prisma.client.campaign.findFirst({
      where: { id, tenantId: actor.tenantId, deletedAt: null },
      include: CAMPAIGN_INCLUDE,
    });
    if (!row) throw new NotFoundException('Campaign not found');
    const stats = readStats(row.stats);
    if (row.coupon && row.startedAt) {
      stats.converted = await this.prisma.client.couponRedemption.count({
        where: { tenantId: actor.tenantId, couponId: row.coupon.id, createdAt: { gte: row.startedAt } },
      });
    }
    return { ...row, stats };
  }

  async create(actor: AuthPrincipal, dto: CreateCampaignDto) {
    await this.assertRefs(actor.tenantId, dto.segmentId, dto.couponId);
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    return this.prisma.client.campaign.create({
      data: {
        tenantId: actor.tenantId,
        name: dto.name,
        segmentId: dto.segmentId ?? null,
        channel: dto.channel,
        templateKey: dto.templateKey,
        message: dto.message ?? null,
        couponId: dto.couponId ?? null,
        status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
        scheduledAt,
        stats: emptyStats() as unknown as Prisma.InputJsonValue,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
      include: CAMPAIGN_INCLUDE,
    });
  }

  async update(actor: AuthPrincipal, id: string, dto: UpdateCampaignDto) {
    const row = await this.get(actor, id);
    if (!EDITABLE.has(row.status)) throw new ConflictException(`Campaign is ${row.status}`);
    await this.assertRefs(actor.tenantId, dto.segmentId, dto.couponId);
    const data: Prisma.CampaignUpdateInput = { updatedBy: actor.userId };
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.segmentId !== undefined) {
      data.segment = dto.segmentId ? { connect: { id: dto.segmentId } } : { disconnect: true };
    }
    if (dto.couponId !== undefined) {
      data.coupon = dto.couponId ? { connect: { id: dto.couponId } } : { disconnect: true };
    }
    if (dto.channel !== undefined) data.channel = dto.channel;
    if (dto.templateKey !== undefined) data.templateKey = dto.templateKey;
    if (dto.message !== undefined) data.message = dto.message;
    if (dto.scheduledAt !== undefined) {
      data.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
      data.status = dto.scheduledAt ? 'SCHEDULED' : 'DRAFT';
    }
    return this.prisma.client.campaign.update({ where: { id }, data, include: CAMPAIGN_INCLUDE });
  }

  async remove(actor: AuthPrincipal, id: string) {
    const row = await this.get(actor, id);
    if (row.status === 'RUNNING') throw new ConflictException('Cancel the running campaign first');
    await this.prisma.client.campaign.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: actor.userId },
    });
    return { ok: true as const };
  }

  async schedule(actor: AuthPrincipal, id: string, scheduledAt: string) {
    const row = await this.get(actor, id);
    if (!EDITABLE.has(row.status)) throw new ConflictException(`Campaign is ${row.status}`);
    if (!row.segmentId) throw new UnprocessableEntityException('Pick a segment before scheduling');
    const at = new Date(scheduledAt);
    return this.prisma.client.campaign.update({
      where: { id },
      data: { status: 'SCHEDULED', scheduledAt: at, updatedBy: actor.userId },
      include: CAMPAIGN_INCLUDE,
    });
  }

  async cancel(actor: AuthPrincipal, id: string) {
    const row = await this.get(actor, id);
    if (row.status === 'COMPLETED' || row.status === 'CANCELLED') {
      throw new ConflictException(`Campaign is ${row.status}`);
    }
    // RUNNING campaigns stop at the next batch boundary (dispatch checks status).
    return this.prisma.client.campaign.update({
      where: { id },
      data: { status: 'CANCELLED', completedAt: new Date(), updatedBy: actor.userId },
      include: CAMPAIGN_INCLUDE,
    });
  }

  /** Send now: claims the campaign and dispatches in the background. */
  async sendNow(actor: AuthPrincipal, id: string) {
    const row = await this.get(actor, id);
    if (!EDITABLE.has(row.status)) throw new ConflictException(`Campaign is ${row.status}`);
    if (!row.segmentId) throw new UnprocessableEntityException('Pick a segment before sending');
    const claimed = await this.claim(id, row.status);
    if (!claimed) throw new ConflictException('Campaign is already being sent');
    void this.dispatch(id).catch((err: unknown) => this.logger.error({ err, campaignId: id }, 'Campaign dispatch crashed'));
    return this.get(actor, id);
  }

  /** Scheduler entrypoint — claim & dispatch every due SCHEDULED campaign. */
  async runDue(now = new Date()): Promise<number> {
    const due = await this.prisma.client.campaign.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: now }, deletedAt: null },
      select: { id: true },
      take: 20,
    });
    let started = 0;
    for (const c of due) {
      if (await this.claim(c.id, 'SCHEDULED')) {
        started += 1;
        await this.dispatch(c.id).catch((err: unknown) =>
          this.logger.error({ err, campaignId: c.id }, 'Campaign dispatch crashed'),
        );
      }
    }
    return started;
  }

  private async claim(id: string, from: string): Promise<boolean> {
    const res = await this.prisma.client.campaign.updateMany({
      where: { id, status: from as 'DRAFT' | 'SCHEDULED' },
      data: { status: 'RUNNING', startedAt: new Date() },
    });
    return res.count === 1;
  }

  /**
   * Resolve the segment and enqueue one notification per member, honouring
   * marketing opt-outs. Idempotency keys make re-runs safe.
   */
  async dispatch(id: string): Promise<CampaignStats> {
    const campaign = await this.prisma.client.campaign.findUnique({
      where: { id },
      include: { segment: true, coupon: { select: { code: true } } },
    });
    if (!campaign?.segment) {
      await this.prisma.client.campaign.update({
        where: { id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      return emptyStats();
    }
    const stats = emptyStats();
    let cancelled = false;
    for await (const batch of this.segments.iterateMembers(campaign.tenantId, campaign.segment.rules)) {
      const status = await this.prisma.client.campaign.findUnique({ where: { id }, select: { status: true } });
      if (status?.status === 'CANCELLED') {
        cancelled = true;
        break;
      }
      for (const c of batch) {
        stats.targeted += 1;
        if (isOptedOut(c.preferences, campaign.channel, 'marketing')) {
          stats.skippedOptOut += 1;
          continue;
        }
        try {
          const ids = await this.notifications.enqueue(
            campaign.tenantId,
            { userId: c.userId, phone: c.phone ?? undefined, email: c.email ?? undefined },
            [campaign.channel],
            {
              template: campaign.templateKey,
              data: {
                customerName: c.fullName,
                message: campaign.message ?? '',
                couponCode: campaign.coupon?.code ?? null,
                campaignId: campaign.id,
              },
              idempotencyKey: `campaign:${campaign.id}:${c.id}`,
              locale: c.preferredLanguage,
            },
            { correlationId: `campaign:${campaign.id}` },
          );
          stats.sent += ids.length > 0 ? 1 : 0;
        } catch (err) {
          stats.failed += 1;
          this.logger.debug({ campaignId: id, reason: (err as Error).message }, 'Campaign enqueue failed');
        }
      }
      await this.prisma.client.campaign.update({
        where: { id },
        data: { stats: stats as unknown as Prisma.InputJsonValue },
      });
    }
    await this.prisma.client.campaign.update({
      where: { id },
      data: {
        stats: stats as unknown as Prisma.InputJsonValue,
        ...(cancelled ? {} : { status: 'COMPLETED', completedAt: new Date() }),
      },
    });
    this.logger.log({ campaignId: id, ...stats, cancelled }, 'Campaign dispatched');
    return stats;
  }

  private async assertRefs(tenantId: string, segmentId?: string, couponId?: string) {
    if (segmentId) {
      const seg = await this.prisma.client.customerSegment.findFirst({
        where: { id: segmentId, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!seg) throw new NotFoundException('Segment not found');
    }
    if (couponId) {
      const c = await this.prisma.client.coupon.findFirst({
        where: { id: couponId, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!c) throw new NotFoundException('Coupon not found');
    }
  }
}
