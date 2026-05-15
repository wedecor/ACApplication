import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { type AnyDomainEvent, type DomainEventName, type UserId } from '@ac/types';
import { randomUUID } from 'node:crypto';
import { ClsService } from 'nestjs-cls';

import { RedisService } from '../redis/redis.service';
import { EventStoreService } from './event-store.service';

/**
 * Typed wrapper around the in-process event emitter. Every publish:
 *   1. Emits in-process so Nest listeners receive it immediately.
 *   2. Fans out to a Redis pub/sub channel `domain-events` so other
 *      instances (and external workers) can react.
 *
 * Subscribers should listen via the `@OnEvent('lead.*')` decorator from
 * `@nestjs/event-emitter`; the gateway translates Redis messages back into
 * local emits when they originate from another node.
 */
const REDIS_CHANNEL = 'domain-events';

interface PublishOptions {
  /** Override the actor (defaults to the request-scoped CLS user). */
  actorId?: string | null;
}

type PayloadOf<TName extends DomainEventName> = Extract<AnyDomainEvent, { name: TName }>['payload'];

@Injectable()
export class DomainEventBus {
  private readonly logger = new Logger(DomainEventBus.name);
  private bridgeStarted = false;

  constructor(
    private readonly emitter: EventEmitter2,
    private readonly redis: RedisService,
    private readonly cls: ClsService,
    private readonly eventStore: EventStoreService,
  ) {
    void this.startRedisBridge();
  }

  /**
   * Publish a typed domain event. Returns the envelope id so callers can
   * correlate it in logs.
   */
  publish<TName extends DomainEventName>(
    name: TName,
    payload: PayloadOf<TName>,
    options: PublishOptions = {},
  ): string {
    const actor = this.cls.get<{ userId?: string }>('actor');
    const envelope: AnyDomainEvent = {
      id: randomUUID(),
      name: name as AnyDomainEvent['name'],
      occurredAt: new Date().toISOString(),
      actorId: ((options.actorId ?? actor?.userId ?? null) as UserId | null),
      payload,
    } as AnyDomainEvent;

    const tenantId = this.cls.get<{ tenantId?: string }>('actor')?.tenantId ?? null;
    this.logger.debug({ event: name, id: envelope.id, tenantId, payload }, 'domain.publish');
    void this.eventStore.persist(envelope, tenantId);
    this.emitter.emit(name, envelope);
    this.redis.pub
      .publish(REDIS_CHANNEL, JSON.stringify(envelope))
      .catch((err) => this.logger.warn({ err }, 'Redis publish failed'));
    return envelope.id;
  }

  private async startRedisBridge(): Promise<void> {
    if (this.bridgeStarted) return;
    this.bridgeStarted = true;
    try {
      await this.redis.sub.subscribe(REDIS_CHANNEL);
      this.redis.sub.on('message', (channel, message) => {
        if (channel !== REDIS_CHANNEL) return;
        try {
          const envelope = JSON.parse(message) as AnyDomainEvent;
          // Re-emit locally so in-process listeners running on this node
          // can react to events published by other nodes.
          this.emitter.emit(envelope.name, envelope);
        } catch (err) {
          this.logger.warn({ err }, 'Failed to parse domain event');
        }
      });
      this.logger.log(`Subscribed to Redis channel ${REDIS_CHANNEL}`);
    } catch (err) {
      this.logger.warn({ err }, 'Could not start Redis bridge — single-node mode');
    }
  }
}
