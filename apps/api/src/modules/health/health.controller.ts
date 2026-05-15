import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HttpHealthIndicator,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';

import { Public } from '../../common/decorators';
import { PrismaService } from '../../common/prisma/prisma.service';

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly _http: HttpHealthIndicator,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {
    void this._http;
  }

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // Database connectivity
      () => this.prismaHealth.pingCheck('database', this.prisma.client),
    ]);
  }

  @Public()
  @Get('liveness')
  liveness() {
    return { status: 'ok' };
  }
}
