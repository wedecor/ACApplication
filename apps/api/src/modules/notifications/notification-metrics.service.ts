import { Inject, Injectable } from '@nestjs/common';
import type { LoadedServerEnv } from '@ac/config';
import { NotificationChannel } from '@ac/types';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

import { APP_CONFIG } from '../../common/config/config.module';

@Injectable()
export class NotificationMetricsService {
  readonly registry = new Registry();
  private readonly sent: Counter;
  private readonly failed: Counter;
  private readonly retries: Counter;
  private readonly dlq: Counter;
  private readonly skipped: Counter;
  private readonly providerLatency: Histogram;
  private readonly queueLag: Histogram;

  constructor(@Inject(APP_CONFIG) env: LoadedServerEnv) {
    if (env.METRICS_ENABLED) {
      collectDefaultMetrics({ register: this.registry, prefix: 'ac_' });
    }

    this.sent = new Counter({
      name: 'notifications_sent_total',
      help: 'Notifications accepted by a provider',
      labelNames: ['channel', 'provider', 'tenant_id'] as const,
      registers: [this.registry],
    });
    this.failed = new Counter({
      name: 'notifications_failed_total',
      help: 'Notifications that failed after all provider attempts',
      labelNames: ['channel', 'provider', 'tenant_id'] as const,
      registers: [this.registry],
    });
    this.retries = new Counter({
      name: 'notification_retry_total',
      help: 'Notification retry attempts scheduled',
      labelNames: ['channel', 'tenant_id'] as const,
      registers: [this.registry],
    });
    this.dlq = new Counter({
      name: 'notification_dlq_total',
      help: 'Notifications moved to dead-letter queue',
      labelNames: ['channel', 'tenant_id'] as const,
      registers: [this.registry],
    });
    this.skipped = new Counter({
      name: 'notifications_skipped_total',
      help: 'Notifications skipped (idempotent duplicate)',
      labelNames: ['reason', 'channel'] as const,
      registers: [this.registry],
    });
    this.providerLatency = new Histogram({
      name: 'notification_provider_latency_ms',
      help: 'Provider round-trip latency in milliseconds',
      labelNames: ['channel', 'provider'] as const,
      buckets: [50, 100, 250, 500, 1000, 2500, 5000, 10000],
      registers: [this.registry],
    });
    this.queueLag = new Histogram({
      name: 'notification_queue_lag_ms',
      help: 'Time from enqueue to worker start',
      labelNames: ['queue'] as const,
      buckets: [100, 500, 1000, 5000, 15000, 60000, 300000],
      registers: [this.registry],
    });
  }

  recordSent(channel: NotificationChannel, provider: string, tenantId: string): void {
    this.sent.inc({ channel, provider, tenant_id: tenantId });
  }

  recordFailed(channel: NotificationChannel, provider: string, tenantId: string): void {
    this.failed.inc({ channel, provider, tenant_id: tenantId });
  }

  recordRetry(channel: NotificationChannel, tenantId: string): void {
    this.retries.inc({ channel, tenant_id: tenantId });
  }

  recordDlq(channel: NotificationChannel, tenantId: string): void {
    this.dlq.inc({ channel, tenant_id: tenantId });
  }

  recordSkipped(reason: string, channel: NotificationChannel): void {
    this.skipped.inc({ reason, channel });
  }

  recordProviderLatency(channel: NotificationChannel, provider: string, ms: number): void {
    this.providerLatency.observe({ channel, provider }, ms);
  }

  recordQueueLag(queue: string, ms: number): void {
    this.queueLag.observe({ queue }, ms);
  }

  async expose(): Promise<string> {
    return this.registry.metrics();
  }
}
