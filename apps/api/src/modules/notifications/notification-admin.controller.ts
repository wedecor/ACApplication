import {
  Controller,
  Get,
  Header,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';
import type { LoadedServerEnv } from '@ac/config';

import { APP_CONFIG } from '../../common/config/config.module';
import { CurrentUser, Public, RequirePermissions } from '../../common/decorators';
import { verifyBearerSecret } from '../../common/security/webhook-auth';
import { NotificationAdminService } from './notification-admin.service';

@ApiTags('notifications-admin')
@Controller({ path: 'notifications/admin', version: '1' })
export class NotificationAdminController {
  constructor(
    private readonly admin: NotificationAdminService,
    @Inject(APP_CONFIG) private readonly env: LoadedServerEnv,
  ) {}

  @Public()
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({ summary: 'Prometheus metrics scrape endpoint (bearer secret required)' })
  metrics(@Headers('authorization') authorization?: string) {
    if (
      !verifyBearerSecret(authorization, this.env.METRICS_SCRAPE_SECRET) &&
      process.env['NODE_ENV'] === 'production'
    ) {
      throw new UnauthorizedException('Invalid metrics scrape credentials');
    }
    if (process.env['NODE_ENV'] === 'production' && !this.env.METRICS_SCRAPE_SECRET) {
      throw new UnauthorizedException('Metrics scrape secret not configured');
    }
    return this.admin.getMetrics();
  }

  @ApiBearerAuth()
  @Get('dashboard')
  @RequirePermissions(Permission.NOTIFICATION_VIEW)
  @ApiOperation({ summary: 'Queue health, provider circuits, kill switch (tenant-scoped)' })
  dashboard(@CurrentUser() actor: AuthPrincipal) {
    return this.admin.getOpsDashboard(actor);
  }

  @ApiBearerAuth()
  @Post('queue/pause')
  @RequirePermissions(Permission.NOTIFICATION_RETRY)
  @ApiOperation({ summary: 'Pause notification dispatch queue (super-admin only)' })
  pauseQueue(@CurrentUser() actor: AuthPrincipal) {
    return this.admin.pauseQueue(actor);
  }

  @ApiBearerAuth()
  @Post('queue/resume')
  @RequirePermissions(Permission.NOTIFICATION_RETRY)
  @ApiOperation({ summary: 'Resume notification dispatch queue (super-admin only)' })
  resumeQueue(@CurrentUser() actor: AuthPrincipal) {
    return this.admin.resumeQueue(actor);
  }

  @ApiBearerAuth()
  @Get('dlq')
  @RequirePermissions(Permission.NOTIFICATION_VIEW)
  @ApiOperation({ summary: 'List dead-letter queue jobs for the tenant' })
  async listDlq(@CurrentUser() actor: AuthPrincipal, @Query('limit') limit?: string) {
    const jobs = await this.admin.listDlq(actor, limit ? Number(limit) : 50);
    return jobs.map((j) => ({
      id: j.id,
      notificationId: j.data.notificationId,
      correlationId: j.data.correlationId,
      failedReason: j.failedReason,
      timestamp: j.timestamp,
    }));
  }

  @ApiBearerAuth()
  @Post('dlq/:jobId/retry')
  @RequirePermissions(Permission.NOTIFICATION_RETRY)
  @ApiOperation({ summary: 'Re-queue a DLQ job (tenant-scoped)' })
  retryDlq(@CurrentUser() actor: AuthPrincipal, @Param('jobId') jobId: string) {
    return this.admin.retryDlq(actor, jobId);
  }

  @ApiBearerAuth()
  @Post('kill-switch/:enabled')
  @RequirePermissions(Permission.NOTIFICATION_RETRY)
  @ApiOperation({ summary: 'Enable or disable tenant kill switch' })
  killSwitch(@CurrentUser() actor: AuthPrincipal, @Param('enabled') enabled: 'on' | 'off') {
    return this.admin.setKillSwitch(actor, enabled === 'on');
  }
}
