import { RedisThrottlerStorage } from '../redis-throttler.storage';

function fakeRedis() {
  const counters = new Map<string, number>();
  const ttls = new Map<string, number>();
  return {
    default: {
      incr: jest.fn(async (k: string) => {
        const n = (counters.get(k) ?? 0) + 1;
        counters.set(k, n);
        return n;
      }),
      pexpire: jest.fn(async (k: string, ms: number) => {
        ttls.set(k, ms);
        return 1;
      }),
      pttl: jest.fn(async (k: string) => ttls.get(k) ?? -2),
      set: jest.fn(async (k: string, _v: string, _px: string, ms: number) => {
        ttls.set(k, ms);
        return 'OK';
      }),
    },
  };
}

describe('RedisThrottlerStorage', () => {
  it('allows up to the limit, then blocks for the block duration', async () => {
    const storage = new RedisThrottlerStorage(fakeRedis() as never);
    for (let i = 1; i <= 5; i += 1) {
      await expect(storage.increment('ip:1', 60_000, 5, 0, 'global')).resolves.toMatchObject({ totalHits: i, isBlocked: false });
    }
    await expect(storage.increment('ip:1', 60_000, 5, 0, 'global')).resolves.toMatchObject({ isBlocked: true, timeToBlockExpire: 60 });
    await expect(storage.increment('ip:1', 60_000, 5, 0, 'global')).resolves.toMatchObject({ isBlocked: true });
  });

  it('keeps separate counters per key and throttler', async () => {
    const storage = new RedisThrottlerStorage(fakeRedis() as never);
    await storage.increment('ip:1', 1000, 1, 0, 'global');
    await expect(storage.increment('ip:2', 1000, 1, 0, 'global')).resolves.toMatchObject({ isBlocked: false });
  });
});
