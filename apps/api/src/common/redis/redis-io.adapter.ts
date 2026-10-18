import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Server, ServerOptions } from 'socket.io';

import { RedisService } from './redis.service';

/**
 * socket.io adapter backed by Redis pub/sub: a broadcast on one API instance
 * reaches sockets connected to every instance. Each domain event is handled
 * once, on the node that produced it — nodes never re-run each other's events.
 */
export class RedisIoAdapter extends IoAdapter {
  constructor(private readonly appContext: INestApplicationContext) {
    super(appContext);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    const redis = this.appContext.get(RedisService);
    server.adapter(createAdapter(redis.pub, redis.sub));
    return server;
  }
}
