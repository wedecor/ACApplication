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

import {
  InventoryAlertKind,
  InventoryAlertSeverity,
  InventoryAlertStatus,
  Permission,
} from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import { InventoryAlertsService } from './inventory-alerts.service';

@ApiTags('inventory:alerts')
@ApiBearerAuth()
@Controller({ path: 'inventory/alerts', version: '1' })
export class InventoryAlertsController {
  constructor(private readonly alerts: InventoryAlertsService) {}

  @Get()
  @RequirePermissions(Permission.INVENTORY_ALERT_VIEW)
  @ApiOperation({ summary: 'List inventory alerts.' })
  async list(
    @CurrentUser() actor: AuthPrincipal,
    @Query('status') status?: InventoryAlertStatus,
    @Query('kind') kind?: InventoryAlertKind,
    @Query('severity') severity?: InventoryAlertSeverity,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const r = await this.alerts.list(actor, {
      status,
      kind,
      severity,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    return { items: r.items, meta: buildPaginationMeta(r.page, r.pageSize, r.total) };
  }

  @Post(':id/acknowledge')
  @RequirePermissions(Permission.INVENTORY_ALERT_ACKNOWLEDGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Acknowledge an alert.' })
  acknowledge(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.alerts.acknowledge(actor, id);
  }

  @Post(':id/resolve')
  @RequirePermissions(Permission.INVENTORY_ALERT_ACKNOWLEDGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve an alert.' })
  resolve(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.alerts.resolve(actor, id);
  }

  @Post(':id/snooze')
  @RequirePermissions(Permission.INVENTORY_ALERT_ACKNOWLEDGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Snooze an alert until a given ISO timestamp.' })
  snooze(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: { until: string },
  ) {
    return this.alerts.snooze(actor, id, new Date(body.until));
  }

  @Post('scan/low-stock')
  @RequirePermissions(Permission.INVENTORY_ALERT_ACKNOWLEDGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger the low-stock scan.' })
  scanLowStock(@CurrentUser() actor: AuthPrincipal) {
    return this.alerts.scanLowStock(actor.tenantId);
  }
}
