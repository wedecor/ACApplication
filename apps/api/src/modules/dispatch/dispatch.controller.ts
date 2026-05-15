import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { AcknowledgeAlertDto } from './dto/acknowledge-alert.dto';
import { ManualAssignDto } from './dto/manual-assign.dto';
import { ReassignDto } from './dto/reassign.dto';
import { DispatchService } from './dispatch.service';

/**
 * Dispatcher control-center API. RBAC:
 *   - VIEW  → dispatcher dashboard, recommendations.
 *   - ASSIGN→ auto / manual.
 *   - OVERRIDE → reassign / forced fallback.
 *   - ACKNOWLEDGE → close alerts.
 */
@ApiTags('dispatch')
@ApiBearerAuth()
@Controller({ path: 'dispatch', version: '1' })
export class DispatchController {
  constructor(private readonly dispatch: DispatchService) {}

  @Post('auto-assign/:bookingId')
  @RequirePermissions(Permission.DISPATCH_ASSIGN)
  @ApiOperation({ summary: 'Auto-assign the best technician for a booking.' })
  auto(@CurrentUser() actor: AuthPrincipal, @Param('bookingId') bookingId: string) {
    return this.dispatch.autoAssign(actor, bookingId);
  }

  @Post('manual-assign')
  @RequirePermissions(Permission.DISPATCH_ASSIGN)
  @ApiOperation({ summary: 'Dispatcher chooses the technician explicitly.' })
  manual(@CurrentUser() actor: AuthPrincipal, @Body() dto: ManualAssignDto) {
    return this.dispatch.manualAssign(actor, dto);
  }

  @Post('reassign')
  @RequirePermissions(Permission.DISPATCH_OVERRIDE)
  @ApiOperation({ summary: 'Replace the technician (auto-pick or explicit).' })
  reassign(@CurrentUser() actor: AuthPrincipal, @Body() dto: ReassignDto) {
    return this.dispatch.reassign(actor, dto);
  }

  @Get('recommendations/:bookingId')
  @RequirePermissions(Permission.DISPATCH_VIEW)
  @ApiOperation({ summary: 'Top-N candidates for a booking, with score breakdown.' })
  recommendations(
    @CurrentUser() actor: AuthPrincipal,
    @Param('bookingId') bookingId: string,
  ) {
    return this.dispatch.recommend(actor, bookingId);
  }

  @Get('unassigned')
  @RequirePermissions(Permission.DISPATCH_VIEW)
  @ApiOperation({ summary: 'Unassigned booking queue.' })
  unassigned(@CurrentUser() actor: AuthPrincipal, @Query('cityId') cityId?: string) {
    return this.dispatch.unassignedQueue(actor.tenantId, cityId);
  }

  @Get('alerts')
  @RequirePermissions(Permission.DISPATCH_VIEW)
  @ApiOperation({ summary: 'Open dispatch alerts for the operational panel.' })
  alerts(@CurrentUser() actor: AuthPrincipal, @Query('cityId') cityId?: string) {
    return this.dispatch.openAlerts(actor.tenantId, cityId);
  }

  @Post('alerts/:id/acknowledge')
  @RequirePermissions(Permission.DISPATCH_ACKNOWLEDGE)
  @ApiOperation({ summary: 'Mark an alert as acknowledged.' })
  acknowledge(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: AcknowledgeAlertDto,
  ) {
    return this.dispatch.acknowledgeAlert(actor, id, dto.note);
  }

  @Get('recent-decisions')
  @RequirePermissions(Permission.DISPATCH_VIEW)
  @ApiOperation({ summary: 'Live activity feed for the dispatcher dashboard.' })
  recent(@CurrentUser() actor: AuthPrincipal, @Query('cityId') cityId?: string) {
    return this.dispatch.recentDecisions(actor.tenantId, cityId);
  }
}
