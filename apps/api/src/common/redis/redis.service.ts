import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Centralized Redis client. We expose three logical instances:
 *   - `default` for general key/value & rate limiting,
 *   - `pub`     for publishing domain events,
 *   - `sub`     for subscribing.
 * BullMQ / queue consumers should bring their own connection bound to the
 * same `REDIS_URL`.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly default: Redis;
  readonly pub: Redis;
  readonly sub: Redis;

  constructor() {
    const url = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
    const tls = process.env['REDIS_TLS'] === 'true';
    const password = process.env['REDIS_PASSWORD'] || undefined;
    const opts = { lazyConnect: true, password, ...(tls ? { tls: {} } : {}) };
    this.default = new Redis(url, opts);
    this.pub = new Redis(url, opts);
    this.sub = new Redis(url, opts);
  }

  async onModuleInit(): Promise<void> {
    const connectIfIdle = async (client: Redis): Promise<void> => {
      if (client.status === 'ready' || client.status === 'connecting' || client.status === 'connect') {
        return;
      }
      await client.connect();
    };
    await Promise.all([connectIfIdle(this.default), connectIfIdle(this.pub), connectIfIdle(this.sub)]);
    this.logger.log('Redis connections established');
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.default.quit(), this.pub.quit(), this.sub.quit()]);
  }
}
