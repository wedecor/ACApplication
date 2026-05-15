import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { LoadedServerEnv } from '@ac/config';
import {
  WORKFLOW_SCHEDULE_QUEUE,
  WORKFLOW_STEP_QUEUE,
  type WorkflowStepJobPayload,
} from '@ac/workflow';
import { Job, Queue, Worker } from 'bullmq';

import { APP_CONFIG } from '../../common/config/config.module';

@Injectable()
export class WorkflowQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkflowQueueService.name);
  private stepQueue?: Queue<WorkflowStepJobPayload>;
  private scheduleQueue?: Queue;
  private stepWorker?: Worker<WorkflowStepJobPayload>;
  private stepProcessor?: (job: Job<WorkflowStepJobPayload>) => Promise<void>;

  constructor(@Inject(APP_CONFIG) private readonly env: LoadedServerEnv) {}

  onModuleInit(): void {
    if (!this.env.NOTIFICATION_QUEUE_ENABLED) return;
    this.start();
  }

  async onModuleDestroy(): Promise<void> {
    await this.stepWorker?.close(true);
    await Promise.all([this.stepQueue?.close(), this.scheduleQueue?.close()]);
  }

  registerStepProcessor(fn: (job: Job<WorkflowStepJobPayload>) => Promise<void>): void {
    this.stepProcessor = fn;
    this.startStepWorker();
  }

  async scheduleStep(payload: WorkflowStepJobPayload, delayMs = 0): Promise<void> {
    if (!this.stepQueue) {
      if (this.stepProcessor) {
        await this.stepProcessor({
          id: payload.stepExecutionId,
          data: payload,
        } as Job<WorkflowStepJobPayload>);
      }
      return;
    }
    await this.stepQueue.add('step', payload, {
      jobId: `step:${payload.stepExecutionId}:${Date.now()}`,
      delay: Math.max(0, delayMs),
      removeOnComplete: { count: 5000 },
      removeOnFail: { count: 2000 },
    });
  }

  async scheduleCron(name: string, data: Record<string, unknown>, delayMs: number): Promise<void> {
    if (!this.scheduleQueue) return;
    await this.scheduleQueue.add(name, data, {
      delay: delayMs,
      removeOnComplete: true,
    });
  }

  private start(): void {
    const connection = this.connection();
    this.stepQueue = new Queue<WorkflowStepJobPayload>(WORKFLOW_STEP_QUEUE, { connection });
    this.scheduleQueue = new Queue(WORKFLOW_SCHEDULE_QUEUE, { connection });
    this.startStepWorker();
    this.logger.log('Workflow BullMQ queues started');
  }

  private startStepWorker(): void {
    if (!this.stepQueue || !this.stepProcessor || this.stepWorker) return;
    this.stepWorker = new Worker<WorkflowStepJobPayload>(
      WORKFLOW_STEP_QUEUE,
      async (job) => this.stepProcessor!(job),
      {
        connection: this.connection(),
        concurrency: Number(process.env['WORKFLOW_WORKER_CONCURRENCY'] ?? 4),
        maxStalledCount: 2,
        stalledInterval: 30_000,
      },
    );
  }

  private connection(): { host: string; port: number; password?: string } {
    const url = new URL(this.env.REDIS_URL);
    return {
      host: url.hostname,
      port: Number(url.port || 6379),
      ...(this.env.REDIS_PASSWORD ? { password: this.env.REDIS_PASSWORD } : {}),
    };
  }
}
