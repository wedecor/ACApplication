import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { LoadedServerEnv } from '@ac/config';
import { retryDelayMs, type NotificationRecipient } from '@ac/notifications';
import { NotificationChannel } from '@ac/types';
import { NotificationStatus } from '@prisma/client';
import type { Job } from 'bullmq';
import type { NotificationJobPayload } from '@ac/notifications';

import { APP_CONFIG } from '../../common/config/config.module';
import { RedisService } from '../../common/redis/redis.service';
import { NotificationFailoverDispatcher } from './notification-failover.dispatcher';
import { NotificationMetricsService } from './notification-metrics.service';
import { NotificationQueueService } from './notification-queue.service';
import { NotificationRateLimiterService } from './notification-rate-limiter.service';
import { NotificationRepository } from './notification.repository';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly repo: NotificationRepository,
    private readonly dispatcher: NotificationFailoverDispatcher,
    private readonly queue: NotificationQueueService,
    private readonly metrics: NotificationMetricsService,
    private readonly rateLimiter: NotificationRateLimiterService,
    private readonly redis: RedisService,
    @Inject(APP_CONFIG) private readonly env: LoadedServerEnv,
  ) {}

  onModuleInit(): void {
    this.queue.registerProcessor((job) => this.processJob(job));
  }

  async enqueue(
    tenantId: string,
    recipient: NotificationRecipient,
    channels: NotificationChannel[],
    message: {
      template: string;
      data?: Record<string, unknown>;
      idempotencyKey?: string;
      locale?: string;
    },
    opts?: { ip?: string; correlationId?: string },
  ): Promise<string[]> {
    await this.rateLimiter.assertDispatchAllowed({
      tenantId,
      userId: recipient.userId,
      template: message.template,
      ip: opts?.ip,
    });

    const correlationId = opts?.correlationId ?? randomUUID();
    const ids: string[] = [];

    for (const channel of channels) {
      const idempotencyKey = message.idempotencyKey
        ? `${message.idempotencyKey}:${channel.toLowerCase()}`
        : undefined;

      const { id, duplicate } = await this.repo.createQueued({
        tenantId,
        userId: recipient.userId,
        channel,
        template: message.template,
        payload: message.data ?? {},
        recipientPhone: recipient.phone,
        recipientEmail: recipient.email,
        idempotencyKey,
        correlationId,
        maxRetries: this.env.NOTIFICATION_MAX_RETRIES,
        provider: this.primaryProvider(channel),
      });

      if (duplicate) {
        const existing = idempotencyKey
          ? await this.repo.findByIdempotency(tenantId, idempotencyKey, channel)
          : await this.repo.findById(id);
        if (existing && this.repo.isTerminal(existing.status)) {
          this.metrics.recordSkipped('terminal_duplicate', channel);
          this.logSkip(existing.id, correlationId, tenantId, channel, 'Already delivered');
          continue;
        }
      }

      ids.push(id);
      await this.queue.schedule(id, correlationId, 0);
    }
    return ids;
  }

  async processNotification(notificationId: string): Promise<void> {
    await this.processJob({
      data: { notificationId },
    } as Job<NotificationJobPayload>);
  }

  async retry(notificationId: string, tenantId: string): Promise<void> {
    const row = await this.repo.findById(notificationId);
    if (!row || row.tenantId !== tenantId) return;
    await this.repo.resetForRetry(notificationId);
    await this.queue.schedule(notificationId, row.correlationId ?? notificationId, 0);
  }

  private async processJob(job: Job<NotificationJobPayload>): Promise<void> {
    const { notificationId, correlationId: jobCorrelation } = job.data;
    const lockKey = `notif:lock:${notificationId}`;
    const acquired = await this.redis.default.set(lockKey, '1', 'EX', 300, 'NX');
    if (acquired !== 'OK') {
      this.logger.debug({ notificationId }, 'Skipping — another worker holds lock');
      return;
    }

    try {
      const row = await this.repo.findById(notificationId);
      if (!row) return;

      const correlationId = row.correlationId ?? jobCorrelation ?? notificationId;

      if (this.repo.isTerminal(row.status) || row.status === NotificationStatus.DLQ) {
        this.metrics.recordSkipped('terminal_status', row.channel);
        this.logSkip(notificationId, correlationId, row.tenantId, row.channel, row.status);
        return;
      }

      if (row.idempotencyKey) {
        const dup = await this.repo.findByIdempotency(row.tenantId, row.idempotencyKey, row.channel);
        if (dup && dup.id !== row.id && this.repo.isTerminal(dup.status)) {
          this.metrics.recordSkipped('idempotency_duplicate', row.channel);
          await this.repo.markSent(row.id, dup.provider ?? undefined, dup.providerRef ?? undefined);
          this.logSkip(notificationId, correlationId, row.tenantId, row.channel, 'Idempotent duplicate');
          return;
        }
      }

      if (row.nextRetryAt && row.nextRetryAt > new Date()) {
        const delay = row.nextRetryAt.getTime() - Date.now();
        await this.queue.schedule(notificationId, correlationId, delay);
        return;
      }

      const claimed = await this.repo.claimForProcessing(notificationId);
      if (!claimed) {
        this.metrics.recordSkipped('claim_failed', row.channel);
        return;
      }

      const payload =
        row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
          ? (row.payload as Record<string, unknown>)
          : {};

      const tokens = row.userId ? await this.repo.loadPushTokens(row.userId) : [];
      const recipient: NotificationRecipient = {
        userId: row.userId ?? undefined,
        email: row.recipientEmail ?? undefined,
        phone: row.recipientPhone ?? undefined,
        deviceTokens: tokens,
      };

      const { text, subject } = await this.repo.buildMessage(row.template, row.channel, payload);

      const result = await this.dispatcher.dispatchWithFailover(
        recipient,
        row.channel,
        { template: row.template, data: payload, text, subject },
        row.tenantId,
      );

      if (result.status === 'sent') {
        await this.repo.markSent(
          notificationId,
          result.provider,
          result.providerRef,
          { provider: result.provider },
        );
        this.metrics.recordSent(row.channel, result.provider ?? 'unknown', row.tenantId);
        this.logger.log({
          msg: 'Notification sent',
          notificationId,
          correlationId,
          tenantId: row.tenantId,
          channel: row.channel,
          provider: result.provider,
          retryCount: row.retryCount,
        });
        return;
      }

      await this.handleFailure(row, result.error ?? 'Dispatch failed', correlationId);
    } finally {
      await this.redis.default.del(lockKey);
    }
  }

  private async handleFailure(
    row: NonNullable<Awaited<ReturnType<NotificationRepository['findById']>>>,
    error: string,
    correlationId: string,
  ): Promise<void> {
    const nextAttempt = row.retryCount + 1;
    this.metrics.recordFailed(row.channel, row.provider ?? 'unknown', row.tenantId);

    if (nextAttempt >= row.maxRetries) {
      await this.repo.markDlq(row.id, error);
      await this.queue.addToDlq(row.id, correlationId);
      this.metrics.recordDlq(row.channel, row.tenantId);
      this.logger.warn({
        msg: 'Notification moved to DLQ',
        notificationId: row.id,
        correlationId,
        tenantId: row.tenantId,
        channel: row.channel,
        retryCount: row.retryCount,
        error,
      });
      return;
    }

    const delay = retryDelayMs(nextAttempt);
    const nextRetryAt = new Date(Date.now() + delay);
    await this.repo.scheduleRetry(row.id, nextAttempt, nextRetryAt, error, row.provider ?? undefined);
    this.metrics.recordRetry(row.channel, row.tenantId);
    await this.queue.schedule(row.id, correlationId, delay);
    this.logger.warn({
      msg: 'Notification scheduled for retry',
      notificationId: row.id,
      correlationId,
      tenantId: row.tenantId,
      channel: row.channel,
      retryCount: nextAttempt,
      error,
    });
  }

  private logSkip(
    notificationId: string,
    correlationId: string,
    tenantId: string,
    channel: NotificationChannel,
    reason: string,
  ): void {
    this.logger.log({
      msg: 'Notification skipped',
      notificationId,
      correlationId,
      tenantId,
      channel,
      reason,
    });
  }

  private primaryProvider(channel: NotificationChannel): string {
    switch (channel) {
      case NotificationChannel.SMS:
        return this.env.SMS_PROVIDER;
      case NotificationChannel.EMAIL:
        return this.env.EMAIL_PROVIDER;
      case NotificationChannel.PUSH:
        return this.env.PUSH_PROVIDER;
      case NotificationChannel.WHATSAPP:
        return 'whatsapp';
      case NotificationChannel.IN_APP:
        return 'websocket';
      default:
        return 'unknown';
    }
  }
}
