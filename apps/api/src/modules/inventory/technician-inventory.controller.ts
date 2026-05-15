import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Permission } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import {
  AllocateStockDto,
  ListTechStockDto,
  ReconcileStockDto,
  ReturnStockDto,
  UseStockDto,
} from './dto/technician-inventory.dto';
import { TechnicianInventoryService } from './technician-inventory.service';

@ApiTags('inventory:technician')
@ApiBearerAuth()
@Controller({ path: 'inventory/technician', version: '1' })
export class TechnicianInventoryController {
  constructor(private readonly tech: TechnicianInventoryService) {}

  @Post('allocate')
  @RequirePermissions(Permission.TECH_INVENTORY_ALLOCATE)
  @ApiOperation({ summary: 'Allocate stock to a technician.' })
  allocate(@CurrentUser() actor: AuthPrincipal, @Body() dto: AllocateStockDto) {
    return this.tech.allocate(actor, dto);
  }

  @Post(':id/acknowledge')
  @RequirePermissions(Permission.TECH_INVENTORY_VIEW)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Technician acknowledges parts received.' })
  acknowledge(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.tech.acknowledge(actor, id);
  }

  @Post(':id/use')
  @RequirePermissions(Permission.TECH_INVENTORY_USE)
  @ApiOperation({ summary: 'Record consumption on a booking.' })
  use(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UseStockDto,
  ) {
    return this.tech.recordUsage(actor, id, dto);
  }

  @Post(':id/return')
  @RequirePermissions(Permission.TECH_INVENTORY_RETURN)
  @ApiOperation({ summary: 'Return unused parts to the source warehouse.' })
  return(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: ReturnStockDto,
  ) {
    return this.tech.returnStock(actor, id, dto);
  }

  @Post(':id/reconcile')
  @RequirePermissions(Permission.TECH_INVENTORY_RECONCILE)
  @ApiOperation({ summary: 'Close the allocation (raises alert if shortfall).' })
  reconcile(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: ReconcileStockDto,
  ) {
    return this.tech.reconcile(actor, id, dto);
  }

  @Get()
  @RequirePermissions(Permission.TECH_INVENTORY_VIEW)
  @ApiOperation({ summary: 'List technician allocations.' })
  async list(@CurrentUser() actor: AuthPrincipal, @Query() dto: ListTechStockDto) {
    const r = await this.tech.list(actor, dto);
    return { items: r.items, meta: buildPaginationMeta(r.page, r.pageSize, r.total) };
  }

  @Get('van/:technicianId')
  @RequirePermissions(Permission.TECH_INVENTORY_VIEW)
  @ApiOperation({ summary: 'Open van inventory for a technician (mobile app).' })
  vanInventory(
    @CurrentUser() actor: AuthPrincipal,
    @Param('technicianId') technicianId: string,
  ) {
    return this.tech.vanInventory(actor, technicianId);
  }
}
