import { Injectable } from '@nestjs/common';
import { NotificationChannel, NotificationStatus, type Prisma } from '@prisma/client';
import { renderTemplate } from '@ac/notifications';

import { PrismaService } from '../../common/prisma/prisma.service';

export interface CreateQueuedNotificationInput {
  tenantId: string;
  userId?: string;
  channel: NotificationChannel;
  template: string;
  payload: Record<string, unknown>;
  recipientPhone?: string;
  recipientEmail?: string;
  idempotencyKey?: string;
  correlationId: string;
  maxRetries: number;
  provider?: string;
}

const TERMINAL_STATUSES: NotificationStatus[] = [
  NotificationStatus.SENT,
  NotificationStatus.DELIVERED,
  NotificationStatus.READ,
];

@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async resolveTemplate(
    key: string,
    channel: NotificationChannel,
    locale = 'en-IN',
  ): Promise<{ subject: string | null; body: string } | null> {
    return this.prisma.client.notificationTemplate.findFirst({
      where: { key, channel, locale, isActive: true },
      select: { subject: true, body: true },
    });
  }

  async loadPushTokens(userId: string): Promise<string[]> {
    const devices = await this.prisma.client.pushDevice.findMany({
      where: { userId, isActive: true, deletedAt: null },
      select: { token: true },
      orderBy: { lastSeenAt: 'desc' },
    });
    return devices.map((d) => d.token);
  }

  async findByIdempotency(
    tenantId: string,
    idempotencyKey: string,
    channel: NotificationChannel,
  ) {
    return this.prisma.client.notification.findFirst({
      where: { tenantId, idempotencyKey, channel, deletedAt: null },
    });
  }

  async createQueued(
    input: CreateQueuedNotificationInput,
  ): Promise<{ id: string; duplicate: boolean }> {
    try {
      const row = await this.prisma.client.notification.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId,
          channel: input.channel,
          template: input.template,
          status: NotificationStatus.QUEUED,
          payload: input.payload as Prisma.InputJsonValue,
          recipientPhone: input.recipientPhone,
          recipientEmail: input.recipientEmail,
          idempotencyKey: input.idempotencyKey,
          correlationId: input.correlationId,
          maxRetries: input.maxRetries,
          provider: input.provider,
        },
        select: { id: true },
      });
      await this.appendEvent(row.id, NotificationStatus.QUEUED, input.provider, 'Enqueued');
      return { id: row.id, duplicate: false };
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2002' &&
        input.idempotencyKey
      ) {
        const existing = await this.findByIdempotency(
          input.tenantId,
          input.idempotencyKey,
          input.channel,
        );
        if (existing) return { id: existing.id, duplicate: true };
      }
      throw err;
    }
  }

  findById(id: string) {
    return this.prisma.client.notification.findFirst({
      where: { id, deletedAt: null },
    });
  }

  findByProviderRef(providerRef: string) {
    return this.prisma.client.notification.findFirst({
      where: { providerRef, deletedAt: null },
    });
  }

  /**
   * Optimistic claim — only one worker processes a notification at a time.
   */
  async claimForProcessing(id: string): Promise<boolean> {
    const result = await this.prisma.client.notification.updateMany({
      where: {
        id,
        deletedAt: null,
        status: { in: [NotificationStatus.QUEUED, NotificationStatus.RETRYING] },
      },
      data: {
        status: NotificationStatus.PROCESSING,
        processingStartedAt: new Date(),
      },
    });
    if (result.count === 1) {
      await this.appendEvent(id, NotificationStatus.PROCESSING, null, 'Worker claimed job');
    }
    return result.count === 1;
  }

  async appendEvent(
    notificationId: string,
    status: NotificationStatus,
    provider: string | null | undefined,
    detail?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.client.notificationDeliveryEvent.create({
      data: {
        notificationId,
        status,
        provider: provider ?? undefined,
        detail,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  async markSent(
    id: string,
    provider: string | undefined,
    providerRef?: string,
    providerResponse?: unknown,
  ): Promise<void> {
    await this.prisma.client.notification.update({
      where: { id },
      data: {
        status: NotificationStatus.SENT,
        provider,
        sentAt: new Date(),
        providerRef: providerRef ?? undefined,
        providerResponse: providerResponse
          ? (providerResponse as Prisma.InputJsonValue)
          : undefined,
        failureReason: null,
        nextRetryAt: null,
        processingStartedAt: null,
      },
    });
    await this.appendEvent(id, NotificationStatus.SENT, provider, 'Accepted by provider', {
      providerRef,
    });
  }

  async markDelivered(id: string, provider?: string, metadata?: Record<string, unknown>) {
    await this.prisma.client.notification.update({
      where: { id },
      data: {
        status: NotificationStatus.DELIVERED,
        deliveredAt: new Date(),
        provider,
      },
    });
    await this.appendEvent(id, NotificationStatus.DELIVERED, provider, 'Delivered', metadata);
  }

  async markRead(id: string, provider?: string) {
    await this.prisma.client.notification.update({
      where: { id },
      data: { status: NotificationStatus.READ, readAt: new Date(), provider },
    });
    await this.appendEvent(id, NotificationStatus.READ, provider, 'Read');
  }

  async markFailed(
    id: string,
    reason: string,
    provider?: string,
    providerResponse?: unknown,
  ): Promise<void> {
    await this.prisma.client.notification.update({
      where: { id },
      data: {
        status: NotificationStatus.FAILED,
        failureReason: reason.slice(0, 2000),
        provider,
        providerResponse: providerResponse
          ? (providerResponse as Prisma.InputJsonValue)
          : undefined,
        processingStartedAt: null,
      },
    });
    await this.appendEvent(id, NotificationStatus.FAILED, provider, reason.slice(0, 500));
  }

  async markDlq(id: string, reason: string): Promise<void> {
    await this.prisma.client.notification.update({
      where: { id },
      data: {
        status: NotificationStatus.DLQ,
        failureReason: reason.slice(0, 2000),
        processingStartedAt: null,
      },
    });
    await this.appendEvent(id, NotificationStatus.DLQ, null, reason.slice(0, 500));
  }

  async scheduleRetry(
    id: string,
    retryCount: number,
    nextRetryAt: Date,
    reason: string,
    provider?: string,
  ): Promise<void> {
    await this.prisma.client.notification.update({
      where: { id },
      data: {
        status: NotificationStatus.RETRYING,
        retryCount,
        nextRetryAt,
        failureReason: reason.slice(0, 2000),
        provider,
        processingStartedAt: null,
      },
    });
    await this.appendEvent(id, NotificationStatus.RETRYING, provider, reason.slice(0, 500), {
      retryCount,
      nextRetryAt: nextRetryAt.toISOString(),
    });
  }

  async resetForRetry(id: string): Promise<void> {
    await this.prisma.client.notification.update({
      where: { id },
      data: {
        status: NotificationStatus.QUEUED,
        retryCount: 0,
        nextRetryAt: null,
        failureReason: null,
        sentAt: null,
        providerRef: null,
        providerResponse: undefined,
        processingStartedAt: null,
      },
    });
    await this.appendEvent(id, NotificationStatus.QUEUED, null, 'Manual retry');
  }

  isTerminal(status: NotificationStatus): boolean {
    return TERMINAL_STATUSES.includes(status);
  }

  async listDeliveryEvents(notificationId: string) {
    return this.prisma.client.notificationDeliveryEvent.findMany({
      where: { notificationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listForTenant(
    tenantId: string,
    opts: {
      status?: NotificationStatus;
      channel?: NotificationChannel;
      search?: string;
      page: number;
      pageSize: number;
    },
  ) {
    const where: Prisma.NotificationWhereInput = {
      tenantId,
      deletedAt: null,
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.channel ? { channel: opts.channel } : {}),
      ...(opts.search
        ? {
            OR: [
              { template: { contains: opts.search, mode: 'insensitive' } },
              { recipientPhone: { contains: opts.search } },
              { recipientEmail: { contains: opts.search, mode: 'insensitive' } },
              { idempotencyKey: { contains: opts.search } },
              { correlationId: { contains: opts.search } },
              { providerRef: { contains: opts.search } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.client.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
      }),
      this.prisma.client.notification.count({ where }),
    ]);
    return { items, total };
  }

  async registerPushDevice(input: {
    tenantId: string;
    userId: string;
    token: string;
    provider: string;
    platform?: string;
    deviceId?: string;
    modelName?: string;
    osVersion?: string;
    appVersion?: string;
  }) {
    return this.prisma.client.pushDevice.upsert({
      where: { token: input.token },
      create: {
        tenantId: input.tenantId,
        userId: input.userId,
        token: input.token,
        provider: input.provider,
        platform: input.platform,
        deviceId: input.deviceId,
        modelName: input.modelName,
        osVersion: input.osVersion,
        appVersion: input.appVersion,
        isActive: true,
        lastSeenAt: new Date(),
      },
      update: {
        tenantId: input.tenantId,
        userId: input.userId,
        provider: input.provider,
        platform: input.platform,
        deviceId: input.deviceId,
        modelName: input.modelName,
        osVersion: input.osVersion,
        appVersion: input.appVersion,
        isActive: true,
        lastSeenAt: new Date(),
        deletedAt: null,
      },
    });
  }

  async deactivatePushDevice(userId: string, token: string): Promise<void> {
    await this.prisma.client.pushDevice.updateMany({
      where: { userId, token, deletedAt: null },
      data: { isActive: false, deletedAt: new Date() },
    });
  }

  async buildMessage(
    templateKey: string,
    channel: NotificationChannel,
    payload: Record<string, unknown>,
    locale = 'en-IN',
  ): Promise<{ text: string; subject?: string }> {
    const tpl = await this.resolveTemplate(templateKey, channel, locale);
    if (!tpl) return { text: templateKey };
    return {
      text: renderTemplate(tpl.body, payload),
      subject: tpl.subject ?? undefined,
    };
  }
}
