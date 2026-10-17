import type { AuthPrincipal } from '@ac/auth';
import { NotificationChannel, NotificationStatus } from '@ac/types';
import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationRepository } from '../notifications/notification.repository';
import { notificationData, notificationTypeForTemplate, titleFromTemplate } from './me.mappers';

/** Only app-surface channels show up in the in-app inbox. */
const INBOX_CHANNELS = [NotificationChannel.IN_APP, NotificationChannel.PUSH];
const DELIVERED_STATUSES = [NotificationStatus.SENT, NotificationStatus.DELIVERED] as const;

@Injectable()
export class MeNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: NotificationRepository,
  ) {}

  async list(actor: AuthPrincipal) {
    const rows = await this.prisma.client.notification.findMany({
      where: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        deletedAt: null,
        channel: { in: INBOX_CHANNELS },
        status: { notIn: [NotificationStatus.FAILED, NotificationStatus.DLQ] },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, template: true, channel: true, payload: true, readAt: true, createdAt: true },
    });

    // The same event is usually fanned out to IN_APP + PUSH; show it once.
    const seen = new Set<string>();
    const unique = rows.filter((r) => {
      const key = `${r.template}:${JSON.stringify(r.payload)}:${Math.floor(r.createdAt.getTime() / 60_000)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const cache = new Map<string, Promise<{ text: string; subject?: string }>>();
    return Promise.all(
      unique.map(async (r) => {
        const payload = (r.payload && typeof r.payload === 'object' ? r.payload : {}) as Record<string, unknown>;
        const cacheKey = `${r.template}:${r.channel}:${JSON.stringify(payload)}`;
        if (!cache.has(cacheKey)) cache.set(cacheKey, this.repo.buildMessage(r.template, r.channel, payload));
        const rendered = await cache.get(cacheKey)!;
        const title =
          (typeof payload.title === 'string' && payload.title) ||
          rendered.subject ||
          titleFromTemplate(r.template);
        const body =
          (typeof payload.body === 'string' && payload.body) ||
          (rendered.text !== r.template ? rendered.text : '');
        return {
          id: r.id,
          title,
          body,
          type: notificationTypeForTemplate(r.template),
          readAt: r.readAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
          data: notificationData(payload),
        };
      }),
    );
  }

  async markRead(actor: AuthPrincipal, id: string): Promise<{ ok: true }> {
    const row = await this.prisma.client.notification.findFirst({
      where: { id, tenantId: actor.tenantId, userId: actor.userId, deletedAt: null },
      select: { id: true, readAt: true, status: true },
    });
    if (!row) throw new NotFoundException('Notification not found');
    if (!row.readAt) {
      await this.prisma.client.notification.update({
        where: { id },
        data: {
          readAt: new Date(),
          // Never touch the delivery state of rows still in the send pipeline.
          ...(DELIVERED_STATUSES.includes(row.status as (typeof DELIVERED_STATUSES)[number])
            ? { status: NotificationStatus.READ }
            : {}),
        },
      });
    }
    return { ok: true };
  }

  async markAllRead(actor: AuthPrincipal): Promise<{ ok: true; updated: number }> {
    const where = {
      tenantId: actor.tenantId,
      userId: actor.userId,
      deletedAt: null,
      readAt: null,
      channel: { in: INBOX_CHANNELS },
    };
    const now = new Date();
    const [delivered, rest] = await this.prisma.client.$transaction([
      this.prisma.client.notification.updateMany({
        where: { ...where, status: { in: [...DELIVERED_STATUSES] } },
        data: { readAt: now, status: NotificationStatus.READ },
      }),
      // Rows still in the send pipeline only get readAt (status untouched).
      this.prisma.client.notification.updateMany({ where, data: { readAt: now } }),
    ]);
    return { ok: true, updated: delivered.count + rest.count };
  }
}
