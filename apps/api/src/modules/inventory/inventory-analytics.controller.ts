import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Permission } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { InventoryAnalyticsService } from './inventory-analytics.service';

@ApiTags('inventory:analytics')
@ApiBearerAuth()
@Controller({ path: 'inventory/analytics', version: '1' })
export class InventoryAnalyticsController {
  constructor(private readonly analytics: InventoryAnalyticsService) {}

  @Get('valuation')
  @RequirePermissions(Permission.INVENTORY_ANALYTICS_VIEW)
  @ApiOperation({ summary: 'Total stock valuation by warehouse.' })
  valuation(@CurrentUser() actor: AuthPrincipal) {
    return this.analytics.valuation(actor);
  }

  @Get('fast-moving')
  @RequirePermissions(Permission.INVENTORY_ANALYTICS_VIEW)
  @ApiOperation({ summary: 'Fastest-moving items in the last N days.' })
  fastMoving(
    @CurrentUser() actor: AuthPrincipal,
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ) {
    return this.analytics.fastMoving(
      actor,
      days ? Number(days) : undefined,
      limit ? Number(limit) : undefined,
    );
  }

  @Get('dead-stock')
  @RequirePermissions(Permission.INVENTORY_ANALYTICS_VIEW)
  @ApiOperation({ summary: 'Items with no outflow in the last N days.' })
  deadStock(@CurrentUser() actor: AuthPrincipal, @Query('days') days?: string) {
    return this.analytics.deadStock(actor, days ? Number(days) : undefined);
  }

  @Get('turnover')
  @RequirePermissions(Permission.INVENTORY_ANALYTICS_VIEW)
  @ApiOperation({ summary: 'Per-item turnover ratio (COGS / avg inventory).' })
  turnover(@CurrentUser() actor: AuthPrincipal, @Query('days') days?: string) {
    return this.analytics.turnover(actor, days ? Number(days) : undefined);
  }

  @Get('procurement-spend')
  @RequirePermissions(Permission.INVENTORY_ANALYTICS_VIEW)
  @ApiOperation({ summary: 'Procurement spend by vendor.' })
  procurementSpend(@CurrentUser() actor: AuthPrincipal, @Query('days') days?: string) {
    return this.analytics.procurementSpend(actor, days ? Number(days) : undefined);
  }

  @Get('technician-wastage')
  @RequirePermissions(Permission.INVENTORY_ANALYTICS_VIEW)
  @ApiOperation({ summary: 'Technician shortfall / wastage report.' })
  technicianWastage(@CurrentUser() actor: AuthPrincipal, @Query('days') days?: string) {
    return this.analytics.technicianWastage(actor, days ? Number(days) : undefined);
  }
}
