import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { RedisService } from '../redis/redis.service';

/** Minimal Redis surface the lock needs (lets tests use a fake). */
export interface LockStore {
  set(key: string, value: string, px: 'PX', ttl: number, nx: 'NX'): Promise<'OK' | null>;
}

let store: LockStore | null = null;
const logger = new Logger('SingleInstance');

/** Wired at boot by {@link SingleInstanceRegistrar}. Exposed for tests. */
export function setSingleInstanceStore(next: LockStore | null): void {
  store = next;
}

/**
 * Run a scheduled job on one API instance per occurrence. Every instance's
 * @Cron fires; the first to take the Redis lock runs, the others skip. The
 * lock is not released after the run — it expires after `holdMs`, which must
 * be a bit shorter than the schedule's interval, so a slightly late tick on
 * another instance can't run the same occurrence again.
 *
 * Without Redis (lock store not wired, or the SET fails) the job still runs,
 * matching single-instance behaviour.
 */
export function SingleInstance(holdMs: number): MethodDecorator {
  return (target, propertyKey, descriptor: PropertyDescriptor) => {
    const original = descriptor.value as (...args: unknown[]) => unknown;
    const key = `cron:lock:${(target as { constructor: { name: string } }).constructor.name}.${String(propertyKey)}`;
    descriptor.value = async function wrapped(this: unknown, ...args: unknown[]) {
      if (store) {
        try {
          const acquired = await store.set(key, String(process.pid), 'PX', holdMs, 'NX');
          if (acquired !== 'OK') return undefined;
        } catch (err) {
          logger.warn({ err, key }, 'Cron lock unavailable — running without it');
        }
      }
      return original.apply(this, args);
    };
    return descriptor;
  };
}

/** Hands the shared Redis connection to the decorator at startup. */
@Injectable()
export class SingleInstanceRegistrar implements OnModuleInit {
  constructor(private readonly redis: RedisService) {}

  onModuleInit(): void {
    setSingleInstanceStore(this.redis.default);
  }
}

/** Hold times sized just under each schedule's interval. */
export const HOLD = {
  minute: 50_000,
  fiveMinutes: 270_000,
  tenMinutes: 540_000,
  thirtyMinutes: 25 * 60_000,
  hour: 55 * 60_000,
  fourHours: 3.5 * 3_600_000,
  sixHours: 5.5 * 3_600_000,
  day: 23 * 3_600_000,
  week: 6.5 * 24 * 3_600_000,
} as const;
