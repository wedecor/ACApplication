import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Permission } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { SupportAnalyticsService } from './support-analytics.service';

@ApiTags('support:analytics')
@ApiBearerAuth()
@Controller({ path: 'support/analytics', version: '1' })
export class SupportAnalyticsController {
  constructor(private readonly analytics: SupportAnalyticsService) {}

  @Get('overview')
  @RequirePermissions(Permission.SUPPORT_ANALYTICS_VIEW)
  overview(
    @CurrentUser() actor: AuthPrincipal,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.overview(actor, { from, to });
  }

  @Get('response-times')
  @RequirePermissions(Permission.SUPPORT_ANALYTICS_VIEW)
  responseTimes(
    @CurrentUser() actor: AuthPrincipal,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.responseTimes(actor, { from, to });
  }

  @Get('agent-productivity')
  @RequirePermissions(Permission.SUPPORT_ANALYTICS_VIEW)
  productivity(
    @CurrentUser() actor: AuthPrincipal,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.agentProductivity(actor, { from, to });
  }

  @Get('channel-breakdown')
  @RequirePermissions(Permission.SUPPORT_ANALYTICS_VIEW)
  channels(
    @CurrentUser() actor: AuthPrincipal,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.channelBreakdown(actor, { from, to });
  }

  @Get('call-center')
  @RequirePermissions(Permission.SUPPORT_ANALYTICS_VIEW)
  calls(
    @CurrentUser() actor: AuthPrincipal,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.callCenter(actor, { from, to });
  }
}
