import type { DomainEventName } from '@ac/types';
import { Injectable } from '@nestjs/common';

import { DomainEventBus } from '../../common/events/domain-event-bus.service';
import type { RepairEventName, RepairEventPayloads } from './domain/events';

/**
 * Thin typed publisher for repair-domain events. Delegates to the shared
 * DomainEventBus so events get persisted to the event store, fanned out over
 * Redis and emitted in-process exactly like core domain events.
 */
@Injectable()
export class RepairEventsService {
  constructor(private readonly bus: DomainEventBus) {}

  publish<TName extends RepairEventName>(name: TName, payload: RepairEventPayloads[TName]): string {
    // The bus is typed against the shared @ac/types registry, which does not
    // list repair events yet; the cast is confined to this one call site.
    return this.bus.publish(name as unknown as DomainEventName, payload as never);
  }
}
