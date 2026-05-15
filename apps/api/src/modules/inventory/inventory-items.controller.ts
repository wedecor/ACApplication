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
  CreateInventoryItemDto,
  ListItemsDto,
  StockAdjustmentDto,
  UpdateInventoryItemDto,
} from './dto/inventory-item.dto';
import { InventoryItemsService } from './inventory-items.service';

@ApiTags('inventory:items')
@ApiBearerAuth()
@Controller({ path: 'inventory/items', version: '1' })
export class InventoryItemsController {
  constructor(private readonly items: InventoryItemsService) {}

  @Post()
  @RequirePermissions(Permission.INVENTORY_MANAGE)
  @ApiOperation({ summary: 'Create a catalogue item (auto-mints SKU + barcode).' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateInventoryItemDto) {
    return this.items.create(actor, dto);
  }

  @Get()
  @RequirePermissions(Permission.INVENTORY_VIEW)
  @ApiOperation({ summary: 'Search the catalogue with optional low-stock filter.' })
  async list(@CurrentUser() actor: AuthPrincipal, @Query() dto: ListItemsDto) {
    const r = await this.items.list(actor, dto);
    return { items: r.items, meta: buildPaginationMeta(r.page, r.pageSize, r.total) };
  }

  @Get('lookup')
  @RequirePermissions(Permission.INVENTORY_VIEW)
  @ApiOperation({ summary: 'Look up an item by SKU, barcode or internal QR slug.' })
  lookup(@CurrentUser() actor: AuthPrincipal, @Query('code') code: string) {
    return this.items.findByCode(actor, code);
  }

  @Get(':id')
  @RequirePermissions(Permission.INVENTORY_VIEW)
  @ApiOperation({ summary: 'Get a single catalogue item with per-warehouse stock.' })
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.items.get(actor, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.INVENTORY_MANAGE)
  @ApiOperation({ summary: 'Update a catalogue item.' })
  update(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.items.update(actor, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.INVENTORY_MANAGE)
  @ApiOperation({ summary: 'Soft-delete an item (must have zero on-hand stock).' })
  remove(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.items.softDelete(actor, id);
  }

  @Post('adjust')
  @RequirePermissions(Permission.INVENTORY_ADJUST)
  @ApiOperation({ summary: 'Manual stock adjustment (writes to the ledger).' })
  adjust(@CurrentUser() actor: AuthPrincipal, @Body() dto: StockAdjustmentDto) {
    return this.items.adjustStock(actor, dto);
  }

  @Get(':id/ledger')
  @RequirePermissions(Permission.INVENTORY_VIEW)
  @ApiOperation({ summary: 'Get the immutable stock ledger for an item.' })
  ledger(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.items.itemLedger(actor, id, {
      warehouseId,
      limit: limit ? Number(limit) : undefined,
      cursor,
    });
  }
}
