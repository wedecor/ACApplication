import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { type AnyDomainEvent, type DomainEventName, type UserId } from '@ac/types';
import { randomUUID } from 'node:crypto';
import { ClsService } from 'nestjs-cls';

import { EventStoreService } from './event-store.service';

/**
 * Typed wrapper around the in-process event emitter. Each event is handled
 * exactly once, by listeners on the node that published it. Websocket
 * fan-out to clients on other nodes goes through the socket.io Redis adapter
 * (see RedisIoAdapter) — not by re-emitting events on every node, which ran
 * every listener (notifications, commissions…) once per node.
 *
 * Subscribers listen via `@OnEvent('lead.*')` from `@nestjs/event-emitter`.
 */
interface PublishOptions {
  /** Override the actor (defaults to the request-scoped CLS user). */
  actorId?: string | null;
  /** Tenant the event belongs to, when there is no request context (crons, webhooks). */
  tenantId?: string | null;
}

type PayloadOf<TName extends DomainEventName> = Extract<AnyDomainEvent, { name: TName }>['payload'];

@Injectable()
export class DomainEventBus {
  private readonly logger = new Logger(DomainEventBus.name);

  constructor(
    private readonly emitter: EventEmitter2,
    private readonly cls: ClsService,
    private readonly eventStore: EventStoreService,
  ) {}

  /**
   * Publish a typed domain event. Returns the envelope id so callers can
   * correlate it in logs.
   */
  publish<TName extends DomainEventName>(
    name: TName,
    payload: PayloadOf<TName>,
    options: PublishOptions = {},
  ): string {
    const actor = this.cls.get<{ userId?: string; tenantId?: string }>('actor');
    // Tenant: request actor, then explicit option, then a tenantId in the payload.
    const tenantId =
      actor?.tenantId ??
      options.tenantId ??
      ((payload as { tenantId?: unknown }).tenantId as string | undefined) ??
      null;
    const envelope: AnyDomainEvent = {
      id: randomUUID(),
      name: name as AnyDomainEvent['name'],
      occurredAt: new Date().toISOString(),
      actorId: ((options.actorId ?? actor?.userId ?? null) as UserId | null),
      tenantId,
      payload,
    } as AnyDomainEvent;

    this.logger.debug({ event: name, id: envelope.id, tenantId, payload }, 'domain.publish');
    void this.eventStore.persist(envelope, tenantId);
    this.emitter.emit(name, envelope);
    return envelope.id;
  }
}
