import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { DomainEventBus } from './domain-event-bus.service';
import { EventStoreService } from './event-store.service';

/**
 * Cross-cutting domain-events module. Re-exports the in-process EventEmitter2
 * via a strongly-typed `DomainEventBus` wrapper so the rest of the codebase
 * never depends on the EventEmitter2 API directly. Outbound fan-out (Redis
 * pub/sub, realtime websockets, analytics, notifications) attach as listeners.
 */
@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 50,
      verboseMemoryLeak: true,
    }),
  ],
  providers: [EventStoreService, DomainEventBus],
  exports: [EventStoreService, DomainEventBus],
})
export class EventsModule {}
