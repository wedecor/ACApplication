import type { AuthPrincipal } from '@ac/auth';
import { Permission } from '@ac/types';
import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AllowAuthenticated, CurrentUser, RequirePermissions } from '../../common/decorators';
import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import {
  CreateTechnicianDto,
  DeactivateTechnicianDto,
  ListTechniciansDto,
  ListTechnicianSubresourceDto,
  UpdateTechnicianDto,
  UpsertTechnicianCommissionRuleDto,
} from './dto/technician.dto';
import { TechniciansService } from './technicians.service';

/**
 * Technician roster management (onboarding, profile, account lifecycle,
 * commission rules).
 *
 * NOTE: `tracking` and `technician-availability` also mount controllers on
 * `/technicians` (`:id/status`, `:id/location`, `:id/history`, `availability`,
 * `live-map`). Keep route names here distinct from those.
 */
@ApiTags('technicians')
@ApiBearerAuth()
@Controller({ path: 'technicians', version: '1' })
export class TechniciansController {
  constructor(private readonly technicians: TechniciansService) {}

  @Get('me')
  @AllowAuthenticated()
  @ApiOperation({ summary: "The signed-in user's own technician profile (field-app session bootstrap)." })
  me(@CurrentUser() actor: AuthPrincipal) {
    return this.technicians.getSelf(actor);
  }

  @Get('form-options')
  @RequirePermissions(Permission.TECHNICIAN_READ)
  @ApiOperation({ summary: 'Cities, skills and commission enums for technician forms.' })
  formOptions(@CurrentUser() actor: AuthPrincipal) {
    return this.technicians.formOptions(actor);
  }

  @Get()
  @RequirePermissions(Permission.TECHNICIAN_READ)
  @ApiOperation({ summary: 'List technicians with filters (city, status, skill, search) + pagination.' })
  async list(@CurrentUser() actor: AuthPrincipal, @Query() query: ListTechniciansDto) {
    const { items, total } = await this.technicians.list(actor, query);
    return { items, pagination: buildPaginationMeta(query.page, query.pageSize, total) };
  }

  @Post()
  @RequirePermissions(Permission.TECHNICIAN_ONBOARD)
  @ApiOperation({ summary: 'Onboard a technician (user + profile + TECHNICIAN role, OTP login).' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateTechnicianDto) {
    return this.technicians.create(actor, dto);
  }

  @Get(':id')
  @RequirePermissions(Permission.TECHNICIAN_READ)
  @ApiOperation({ summary: 'Technician profile with stats, recent jobs and ratings.' })
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.technicians.getById(actor, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.TECHNICIAN_WRITE)
  @ApiOperation({ summary: 'Update technician profile fields.' })
  update(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string, @Body() dto: UpdateTechnicianDto) {
    return this.technicians.update(actor, id, dto);
  }

  @Post(':id/deactivate')
  @RequirePermissions(Permission.TECHNICIAN_WRITE)
  @ApiOperation({
    summary: 'Suspend the technician account (blocked while open bookings exist unless force=true).',
  })
  deactivate(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: DeactivateTechnicianDto,
  ) {
    return this.technicians.deactivate(actor, id, dto);
  }

  @Post(':id/reactivate')
  @RequirePermissions(Permission.TECHNICIAN_WRITE)
  @ApiOperation({ summary: 'Re-enable a suspended technician account.' })
  reactivate(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.technicians.reactivate(actor, id);
  }

  @Get(':id/bookings')
  @RequirePermissions(Permission.TECHNICIAN_READ)
  @ApiOperation({ summary: 'Paginated job history for a technician.' })
  async bookings(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Query() query: ListTechnicianSubresourceDto,
  ) {
    const { items, total } = await this.technicians.listBookings(actor, id, query);
    return { items, pagination: buildPaginationMeta(query.page, query.pageSize, total) };
  }

  @Get(':id/ratings')
  @RequirePermissions(Permission.TECHNICIAN_READ)
  @ApiOperation({ summary: 'Paginated customer ratings for a technician.' })
  async ratings(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Query() query: ListTechnicianSubresourceDto,
  ) {
    const { items, total } = await this.technicians.listRatings(actor, id, query);
    return { items, pagination: buildPaginationMeta(query.page, query.pageSize, total) };
  }

  @Get(':id/commission-rule')
  @RequirePermissions(Permission.PAYOUT_VIEW)
  @ApiOperation({ summary: 'Commission rule for a technician (null rule = tenant default applies).' })
  commissionRule(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.technicians.getCommissionRule(actor, id);
  }

  @Put(':id/commission-rule')
  @RequirePermissions(Permission.PAYOUT_APPROVE)
  @ApiOperation({ summary: 'Create or replace the commission rule for a technician.' })
  upsertCommissionRule(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpsertTechnicianCommissionRuleDto,
  ) {
    return this.technicians.upsertCommissionRule(actor, id, dto);
  }

  @Delete(':id/commission-rule')
  @RequirePermissions(Permission.PAYOUT_APPROVE)
  @ApiOperation({ summary: 'Remove the custom commission rule (falls back to the default).' })
  deleteCommissionRule(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.technicians.deleteCommissionRule(actor, id);
  }
}
