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

import { Permission, StockTransferStatus } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { CurrentUser, RequirePermissions } from '../../common/decorators';
import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import {
  CreateTransferDto,
  ReceiveTransferDto,
} from './dto/inventory-item.dto';
import { StockTransfersService } from './stock-transfers.service';

@ApiTags('inventory:transfers')
@ApiBearerAuth()
@Controller({ path: 'inventory/transfers', version: '1' })
export class StockTransfersController {
  constructor(private readonly transfers: StockTransfersService) {}

  @Post()
  @RequirePermissions(Permission.STOCK_TRANSFER_REQUEST)
  @ApiOperation({ summary: 'Request a stock transfer between warehouses.' })
  request(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateTransferDto) {
    return this.transfers.request(actor, dto);
  }

  @Get()
  @RequirePermissions(Permission.STOCK_TRANSFER_VIEW)
  @ApiOperation({ summary: 'List stock transfers.' })
  async list(
    @CurrentUser() actor: AuthPrincipal,
    @Query('status') status?: StockTransferStatus,
    @Query('sourceWarehouseId') sourceWarehouseId?: string,
    @Query('destWarehouseId') destWarehouseId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const r = await this.transfers.list(actor, {
      status,
      sourceWarehouseId,
      destWarehouseId,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    return { items: r.items, meta: buildPaginationMeta(r.page, r.pageSize, r.total) };
  }

  @Get(':id')
  @RequirePermissions(Permission.STOCK_TRANSFER_VIEW)
  @ApiOperation({ summary: 'Get a transfer with line items.' })
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.transfers.get(actor, id);
  }

  @Post(':id/approve')
  @RequirePermissions(Permission.STOCK_TRANSFER_APPROVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve transfer (reserves source stock).' })
  approve(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.transfers.approve(actor, id);
  }

  @Post(':id/reject')
  @RequirePermissions(Permission.STOCK_TRANSFER_APPROVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a transfer.' })
  reject(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.transfers.reject(actor, id, body.reason);
  }

  @Post(':id/dispatch')
  @RequirePermissions(Permission.STOCK_TRANSFER_DISPATCH)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dispatch (move stock out of source warehouse).' })
  dispatch(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.transfers.dispatch(actor, id);
  }

  @Post(':id/receive')
  @RequirePermissions(Permission.STOCK_TRANSFER_RECEIVE)
  @ApiOperation({ summary: 'Receive transfer at the destination.' })
  receive(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: ReceiveTransferDto,
  ) {
    return this.transfers.receive(actor, id, dto);
  }

  @Post(':id/cancel')
  @RequirePermissions(Permission.STOCK_TRANSFER_APPROVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a transfer (before dispatch).' })
  cancel(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.transfers.cancel(actor, id, body.reason);
  }
}
