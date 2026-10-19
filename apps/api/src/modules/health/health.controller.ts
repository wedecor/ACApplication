import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckError,
  HealthCheckService,
  type HealthIndicatorResult,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';

import { Public } from '../../common/decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Readiness: the API can serve traffic only with both Postgres and Redis. */
  @Public()
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe (database + Redis).' })
  check() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma.client),
      () => this.redisPing(),
    ]);
  }

  @Public()
  @Get('liveness')
  @ApiOperation({ summary: 'Liveness probe (process is up).' })
  liveness() {
    return { status: 'ok' };
  }

  private async redisPing(): Promise<HealthIndicatorResult> {
    try {
      const pong = await Promise.race([
        this.redis.default.ping(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2_000)),
      ]);
      if (pong !== 'PONG') throw new Error(`unexpected reply ${pong}`);
      return { redis: { status: 'up' } };
    } catch (err) {
      throw new HealthCheckError('Redis check failed', { redis: { status: 'down', message: (err as Error).message } });
    }
  }
}
