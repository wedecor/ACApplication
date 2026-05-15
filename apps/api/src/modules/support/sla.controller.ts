import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Permission } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { SlaProfileDto } from './dto/sla.dto';
import { SlaService } from './sla.service';

@ApiTags('support:sla')
@ApiBearerAuth()
@Controller({ path: 'support/sla', version: '1' })
export class SlaController {
  constructor(private readonly sla: SlaService) {}

  @Get('profiles')
  @RequirePermissions(Permission.SLA_VIEW)
  list(@CurrentUser() actor: AuthPrincipal) {
    return this.sla.listProfiles(actor);
  }

  @Post('profiles')
  @RequirePermissions(Permission.SLA_MANAGE)
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: SlaProfileDto) {
    return this.sla.createProfile(actor, dto);
  }

  @Put('profiles/:id')
  @RequirePermissions(Permission.SLA_MANAGE)
  update(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: SlaProfileDto,
  ) {
    return this.sla.updateProfile(actor, id, dto);
  }

  @Delete('profiles/:id')
  @RequirePermissions(Permission.SLA_MANAGE)
  remove(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.sla.deleteProfile(actor, id);
  }

  @Post('scan')
  @RequirePermissions(Permission.SLA_MANAGE)
  @ApiOperation({ summary: 'Trigger an immediate SLA scan for this tenant.' })
  scan(@CurrentUser() actor: AuthPrincipal) {
    return this.sla.scanTenant(actor.tenantId);
  }
}
