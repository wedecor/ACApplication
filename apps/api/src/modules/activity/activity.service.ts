import { Injectable } from '@nestjs/common';
import { type ActivityType } from '@ac/types';
import type { Prisma } from '@ac/database';

import { PrismaService } from '../../common/prisma/prisma.service';

interface RecordParams {
  tenantId: string;
  type: ActivityType;
  actorUserId?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  message?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Activity / timeline writer. Writes are best-effort: a failure to persist a
 * timeline row never breaks the parent transaction. Callers that need
 * transactional guarantees can opt-in by passing a Prisma transaction client
 * via the `tx` parameter.
 */
@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  recordLeadActivity(
    leadId: string,
    params: RecordParams,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = (tx ?? this.prisma.client) as Prisma.TransactionClient;
    return client.leadActivity
      .create({
        data: {
          leadId,
          tenantId: params.tenantId,
          type: params.type,
          fromStatus: params.fromStatus ?? null,
          toStatus: params.toStatus ?? null,
          actorUserId: params.actorUserId ?? null,
          message: params.message ?? null,
          metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
        },
      })
      .then(() => undefined)
      .catch(() => undefined);
  }

  recordBookingActivity(
    bookingId: string,
    params: RecordParams,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = (tx ?? this.prisma.client) as Prisma.TransactionClient;
    return client.bookingActivity
      .create({
        data: {
          bookingId,
          tenantId: params.tenantId,
          type: params.type,
          fromStatus: params.fromStatus ?? null,
          toStatus: params.toStatus ?? null,
          actorUserId: params.actorUserId ?? null,
          message: params.message ?? null,
          metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
        },
      })
      .then(() => undefined)
      .catch(() => undefined);
  }

  listLeadActivities(leadId: string, limit = 50) {
    return this.prisma.client.leadActivity.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        actor: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
  }

  listBookingActivities(bookingId: string, limit = 50) {
    return this.prisma.client.bookingActivity.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        actor: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
  }
}
