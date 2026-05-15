import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { ChangeTechnicianStatusDto } from '../tracking/dto/change-status.dto';
import { TechnicianAvailabilityService } from './technician-availability.service';

@ApiTags('technicians')
@ApiBearerAuth()
@Controller({ path: 'technicians', version: '1' })
export class TechnicianAvailabilityController {
  constructor(private readonly service: TechnicianAvailabilityService) {}

  @Post(':id/status')
  @RequirePermissions(Permission.TECHNICIAN_STATUS_WRITE)
  @ApiOperation({ summary: 'Change technician status (self-service from the field app).' })
  setStatus(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: ChangeTechnicianStatusDto,
  ) {
    return this.service.setStatus(actor.userId, id, dto.status, dto.reason);
  }

  @Get('availability')
  @RequirePermissions(Permission.TECHNICIAN_TRACK)
  @ApiOperation({ summary: 'Dispatcher snapshot of who is available, by city.' })
  availability(@CurrentUser() actor: AuthPrincipal, @Query('cityId') cityId?: string) {
    return this.service.availabilityOverview(actor.tenantId, cityId);
  }
}
