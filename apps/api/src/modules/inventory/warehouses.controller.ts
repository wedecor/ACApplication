import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Permission } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import {
  CreateWarehouseDto,
  CreateZoneDto,
  ListWarehousesDto,
  UpdateWarehouseDto,
} from './dto/warehouse.dto';
import { WarehousesService } from './warehouses.service';

@ApiTags('inventory:warehouses')
@ApiBearerAuth()
@Controller({ path: 'inventory/warehouses', version: '1' })
export class WarehousesController {
  constructor(private readonly warehouses: WarehousesService) {}

  @Post()
  @RequirePermissions(Permission.WAREHOUSE_MANAGE)
  @ApiOperation({ summary: 'Create a warehouse.' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateWarehouseDto) {
    return this.warehouses.create(actor, dto);
  }

  @Get()
  @RequirePermissions(Permission.WAREHOUSE_VIEW)
  @ApiOperation({ summary: 'List warehouses for the current tenant.' })
  async list(@CurrentUser() actor: AuthPrincipal, @Query() dto: ListWarehousesDto) {
    const r = await this.warehouses.list(actor, dto);
    return { items: r.items, meta: buildPaginationMeta(r.page, r.pageSize, r.total) };
  }

  @Get(':id')
  @RequirePermissions(Permission.WAREHOUSE_VIEW)
  @ApiOperation({ summary: 'Get a single warehouse (with zones).' })
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.warehouses.get(actor, id);
  }

  @Get(':id/stats')
  @RequirePermissions(Permission.WAREHOUSE_VIEW)
  @ApiOperation({ summary: 'Get aggregate stats for one warehouse.' })
  stats(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.warehouses.stats(actor, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.WAREHOUSE_MANAGE)
  @ApiOperation({ summary: 'Update a warehouse.' })
  update(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseDto,
  ) {
    return this.warehouses.update(actor, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.WAREHOUSE_MANAGE)
  @ApiOperation({ summary: 'Soft-delete a warehouse (must be empty).' })
  delete(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.warehouses.softDelete(actor, id);
  }

  @Post(':id/zones')
  @RequirePermissions(Permission.WAREHOUSE_MANAGE)
  @ApiOperation({ summary: 'Add a zone / bin to a warehouse.' })
  addZone(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: CreateZoneDto,
  ) {
    return this.warehouses.addZone(actor, id, dto);
  }

  @Delete(':id/zones/:zoneId')
  @RequirePermissions(Permission.WAREHOUSE_MANAGE)
  @ApiOperation({ summary: 'Remove a zone (must be empty).' })
  removeZone(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Param('zoneId') zoneId: string,
  ) {
    return this.warehouses.removeZone(actor, id, zoneId);
  }
}
