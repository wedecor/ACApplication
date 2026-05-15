import { Injectable, Logger } from '@nestjs/common';
import { DomainEventRecordStatus, type Prisma } from '@prisma/client';
import type { AnyDomainEvent } from '@ac/types';
import { DOMAIN_EVENT_DLQ } from '@ac/workflow';
import { Queue } from 'bullmq';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

/**
 * Durable event store — persists every domain event for replay, tracing,
 * and dead-event recovery. Wired from DomainEventBus on every publish.
 */
@Injectable()
export class EventStoreService {
  private readonly logger = new Logger(EventStoreService.name);
  private dlq?: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async persist(envelope: AnyDomainEvent, tenantId?: string | null): Promise<void> {
    try {
      await this.prisma.client.domainEventRecord.create({
        data: {
          id: envelope.id,
          tenantId: tenantId ?? undefined,
          name: envelope.name,
          schemaVer: 1,
          envelope: envelope as unknown as Prisma.InputJsonValue,
          status: DomainEventRecordStatus.PUBLISHED,
          traceId: envelope.id,
        },
      });
    } catch (err) {
      this.logger.error({ err, eventId: envelope.id }, 'Failed to persist domain event');
      await this.moveToDeadLetter(envelope, err);
    }
  }

  async markProcessed(eventId: string): Promise<void> {
    await this.prisma.client.domainEventRecord.updateMany({
      where: { id: eventId },
      data: { status: DomainEventRecordStatus.PROCESSED, processedAt: new Date() },
    });
  }

  async listForReplay(opts: {
    tenantId?: string;
    name?: string;
    since?: Date;
    limit?: number;
  }): Promise<AnyDomainEvent[]> {
    const rows = await this.prisma.client.domainEventRecord.findMany({
      where: {
        ...(opts.tenantId ? { tenantId: opts.tenantId } : {}),
        ...(opts.name ? { name: opts.name } : {}),
        ...(opts.since ? { createdAt: { gte: opts.since } } : {}),
        status: { in: [DomainEventRecordStatus.PUBLISHED, DomainEventRecordStatus.PROCESSED] },
      },
      orderBy: { createdAt: 'asc' },
      take: opts.limit ?? 500,
    });
    return rows.map((r) => r.envelope as unknown as AnyDomainEvent);
  }

  async replay(eventIds: string[]): Promise<number> {
    const rows = await this.prisma.client.domainEventRecord.findMany({
      where: { id: { in: eventIds } },
    });
    let count = 0;
    for (const row of rows) {
      await this.prisma.client.domainEventRecord.create({
        data: {
          tenantId: row.tenantId,
          name: row.name,
          schemaVer: row.schemaVer,
          envelope: row.envelope as Prisma.InputJsonValue,
          status: DomainEventRecordStatus.PUBLISHED,
          replayOf: row.id,
        },
      });
      count += 1;
    }
    return count;
  }

  private async moveToDeadLetter(envelope: AnyDomainEvent, err: unknown): Promise<void> {
    if (!this.dlq) {
      this.dlq = new Queue(DOMAIN_EVENT_DLQ, { connection: this.redis.default });
    }
    await this.dlq.add('dead', { envelope, error: String(err) });
    await this.prisma.client.domainEventRecord
      .create({
        data: {
          id: envelope.id,
          name: envelope.name,
          schemaVer: 1,
          envelope: envelope as unknown as Prisma.InputJsonValue,
          status: DomainEventRecordStatus.DEAD,
        },
      })
      .catch(() => undefined);
  }
}
