import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { LoadedServerEnv } from '@ac/config';
import { NOTIFICATION_DLQ_NAME, NOTIFICATION_QUEUE_NAME, type NotificationJobPayload } from '@ac/notifications';
import { Job, Queue, Worker } from 'bullmq';

import { APP_CONFIG } from '../../common/config/config.module';
import { NotificationMetricsService } from './notification-metrics.service';

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

@Injectable()
export class NotificationQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationQueueService.name);
  private queue?: Queue<NotificationJobPayload>;
  private dlq?: Queue<NotificationJobPayload>;
  private worker?: Worker<NotificationJobPayload>;
  private processor?: (job: Job<NotificationJobPayload>) => Promise<void>;
  private shuttingDown = false;

  constructor(
    @Inject(APP_CONFIG) private readonly env: LoadedServerEnv,
    private readonly metrics: NotificationMetricsService,
  ) {}

  onModuleInit(): void {
    if (!this.env.NOTIFICATION_QUEUE_ENABLED) return;
    this.start();
  }

  async onModuleDestroy(): Promise<void> {
    this.shuttingDown = true;
    if (this.worker) {
      await this.worker.close(true);
    }
    await Promise.all([this.queue?.close(), this.dlq?.close()]);
    this.logger.log('Notification queue shut down gracefully');
  }

  registerProcessor(fn: (job: Job<NotificationJobPayload>) => Promise<void>): void {
    this.processor = fn;
    if (this.env.NOTIFICATION_QUEUE_ENABLED && !this.worker) {
      this.startWorker();
    }
  }

  async schedule(notificationId: string, correlationId: string, delayMs = 0): Promise<void> {
    if (!this.queue) {
      if (this.processor) {
        await this.processor({
          id: notificationId,
          data: { notificationId, correlationId },
        } as Job<NotificationJobPayload>);
      }
      return;
    }
    await this.queue.add(
      'dispatch',
      { notificationId, correlationId },
      {
        jobId: `dispatch:${notificationId}:${Date.now()}`,
        delay: Math.max(0, delayMs),
        removeOnComplete: { count: 2000 },
        removeOnFail: { count: 1000 },
        attempts: 1,
      },
    );
  }

  async addToDlq(notificationId: string, correlationId: string): Promise<void> {
    if (!this.dlq) return;
    await this.dlq.add('dead', { notificationId, correlationId }, { jobId: `dlq:${notificationId}` });
  }

  async getStats(): Promise<{ main: QueueStats; dlq: QueueStats }> {
    const main = await this.statsFor(this.queue, NOTIFICATION_QUEUE_NAME);
    const dead = await this.statsFor(this.dlq, NOTIFICATION_DLQ_NAME);
    return { main, dlq: dead };
  }

  async pause(): Promise<void> {
    await this.queue?.pause();
  }

  async resume(): Promise<void> {
    await this.queue?.resume();
  }

  async listDlqJobs(limit = 50) {
    if (!this.dlq) return [];
    return this.dlq.getJobs(['waiting', 'delayed', 'failed'], 0, limit - 1);
  }

  async retryDlqJob(jobId: string): Promise<void> {
    const job = await this.dlq?.getJob(jobId);
    if (!job?.data.notificationId) return;
    await this.schedule(job.data.notificationId, job.data.correlationId ?? job.data.notificationId, 0);
    await job.remove();
  }

  getDlqQueue(): Queue<NotificationJobPayload> | undefined {
    return this.dlq;
  }

  private start(): void {
    const connection = this.redisConnection();
    this.queue = new Queue<NotificationJobPayload>(NOTIFICATION_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        removeOnComplete: { count: 2000 },
        removeOnFail: { count: 1000 },
      },
    });
    this.dlq = new Queue<NotificationJobPayload>(NOTIFICATION_DLQ_NAME, { connection });
    this.startWorker();
    this.logger.log('Notification BullMQ queues started');
  }

  private startWorker(): void {
    if (!this.queue || !this.processor || this.worker) return;
    const connection = this.redisConnection();
    this.worker = new Worker<NotificationJobPayload>(
      NOTIFICATION_QUEUE_NAME,
      async (job) => {
        if (this.shuttingDown) throw new Error('Worker shutting down');
        const enqueuedAt = job.timestamp;
        this.metrics.recordQueueLag(NOTIFICATION_QUEUE_NAME, Date.now() - enqueuedAt);
        await this.processor!(job);
      },
      {
        connection,
        concurrency: this.env.NOTIFICATION_WORKER_CONCURRENCY,
        maxStalledCount: 2,
        stalledInterval: 30_000,
      },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(
        { jobId: job?.id, notificationId: job?.data?.notificationId, err },
        'BullMQ job failed',
      );
    });
    this.worker.on('stalled', (jobId) => {
      this.logger.warn({ jobId }, 'BullMQ job stalled — will be recovered');
    });
  }

  private async statsFor(
    queue: Queue<NotificationJobPayload> | undefined,
    name: string,
  ): Promise<QueueStats> {
    if (!queue) {
      return { name, waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: false };
    }
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ]);
    return { name, waiting, active, completed, failed, delayed, paused };
  }

  private redisConnection(): { host: string; port: number; password?: string; tls?: object } {
    const url = new URL(this.env.REDIS_URL);
    return {
      host: url.hostname,
      port: Number(url.port || 6379),
      ...(this.env.REDIS_PASSWORD ? { password: this.env.REDIS_PASSWORD } : {}),
      ...(this.env.REDIS_TLS ? { tls: {} } : {}),
    };
  }
}
