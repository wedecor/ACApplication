import type { AuthPrincipal } from '@ac/auth';
import { Permission } from '@ac/types';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, RequirePermissions } from '../../../common/decorators';
import { buildPaginationMeta } from '../../../common/dto/pagination.dto';
import { AppliancesService } from './appliances.service';
import { CreateApplianceDto, ListAppliancesDto, UpdateApplianceDto } from './dto/appliance.dto';

@ApiTags('repair')
@ApiBearerAuth()
@Controller({ path: 'repair/appliances', version: '1' })
export class AppliancesController {
  constructor(private readonly appliances: AppliancesService) {}

  @Get()
  @RequirePermissions(Permission.APPLIANCE_VIEW)
  @ApiOperation({ summary: 'List customer appliances (filter by customer, category, serial, free text).' })
  async list(@CurrentUser() actor: AuthPrincipal, @Query() query: ListAppliancesDto) {
    const { items, total } = await this.appliances.list(actor, query);
    return { items, pagination: buildPaginationMeta(query.page, query.pageSize, total) };
  }

  @Post()
  @RequirePermissions(Permission.APPLIANCE_MANAGE)
  @ApiOperation({ summary: 'Register an appliance for a customer.' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateApplianceDto) {
    return this.appliances.create(actor, dto);
  }

  @Get(':id')
  @RequirePermissions(Permission.APPLIANCE_VIEW)
  @ApiOperation({ summary: 'Get one appliance.' })
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.appliances.get(actor, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.APPLIANCE_MANAGE)
  @ApiOperation({ summary: 'Update an appliance.' })
  update(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateApplianceDto,
  ) {
    return this.appliances.update(actor, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.APPLIANCE_MANAGE)
  @ApiOperation({ summary: 'Soft-delete an appliance.' })
  remove(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.appliances.remove(actor, id);
  }

  @Get(':id/history')
  @RequirePermissions(Permission.APPLIANCE_VIEW)
  @ApiOperation({ summary: 'Service history: bookings, job cards and warranty claims (newest first).' })
  history(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.appliances.history(actor, id);
  }

  @Get(':id/warranty-status')
  @RequirePermissions(Permission.APPLIANCE_VIEW)
  @ApiOperation({ summary: 'Manufacturer / extended / repair warranty windows and AMC coverage.' })
  warrantyStatus(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.appliances.warrantyStatus(actor, id);
  }
}
