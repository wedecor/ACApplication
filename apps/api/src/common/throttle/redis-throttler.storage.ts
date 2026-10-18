import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';

import type { RedisService } from '../redis/redis.service';

/**
 * Fixed-window rate-limit counters in Redis, so limits hold across API
 * instances (the default storage is a per-process Map). Times are returned
 * in seconds, matching @nestjs/throttler's in-memory storage.
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitsKey = `throttle:${throttlerName}:${key}`;
    const blockKey = `throttle:block:${throttlerName}:${key}`;
    const r = this.redis.default;

    const blockedFor = await r.pttl(blockKey);
    if (blockedFor > 0) {
      const hitsLeft = await r.pttl(hitsKey);
      return {
        totalHits: limit + 1,
        timeToExpire: toSeconds(hitsLeft),
        isBlocked: true,
        timeToBlockExpire: toSeconds(blockedFor),
      };
    }

    const totalHits = await r.incr(hitsKey);
    if (totalHits === 1) await r.pexpire(hitsKey, ttl);
    const timeToExpire = toSeconds(await r.pttl(hitsKey));

    if (totalHits > limit) {
      const block = blockDuration > 0 ? blockDuration : ttl;
      await r.set(blockKey, '1', 'PX', block);
      return { totalHits, timeToExpire, isBlocked: true, timeToBlockExpire: toSeconds(block) };
    }
    return { totalHits, timeToExpire, isBlocked: false, timeToBlockExpire: 0 };
  }
}

function toSeconds(ms: number): number {
  return ms > 0 ? Math.ceil(ms / 1000) : 0;
}
