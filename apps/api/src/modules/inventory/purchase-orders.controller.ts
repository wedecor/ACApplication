import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
  CancelPurchaseOrderDto,
  CreateGoodsReceiptDto,
  CreatePurchaseOrderDto,
  ListPurchaseOrdersDto,
  UpdatePurchaseOrderDto,
} from './dto/purchase-order.dto';
import { PurchaseOrdersService } from './purchase-orders.service';

@ApiTags('inventory:purchase-orders')
@ApiBearerAuth()
@Controller({ path: 'inventory/purchase-orders', version: '1' })
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrders: PurchaseOrdersService) {}

  @Post()
  @RequirePermissions(Permission.PURCHASE_ORDER_CREATE)
  @ApiOperation({ summary: 'Draft a purchase order.' })
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreatePurchaseOrderDto) {
    return this.purchaseOrders.create(actor, dto);
  }

  @Get()
  @RequirePermissions(Permission.PURCHASE_ORDER_VIEW)
  @ApiOperation({ summary: 'List purchase orders.' })
  async list(@CurrentUser() actor: AuthPrincipal, @Query() dto: ListPurchaseOrdersDto) {
    const r = await this.purchaseOrders.list(actor, dto);
    return { items: r.items, meta: buildPaginationMeta(r.page, r.pageSize, r.total) };
  }

  @Get(':id')
  @RequirePermissions(Permission.PURCHASE_ORDER_VIEW)
  @ApiOperation({ summary: 'Get a single purchase order with items + receipts.' })
  get(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.purchaseOrders.get(actor, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.PURCHASE_ORDER_CREATE)
  @ApiOperation({ summary: 'Edit a DRAFT / AWAITING_APPROVAL PO.' })
  update(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderDto,
  ) {
    return this.purchaseOrders.update(actor, id, dto);
  }

  @Post(':id/submit')
  @RequirePermissions(Permission.PURCHASE_ORDER_CREATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit a DRAFT for approval.' })
  submit(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.purchaseOrders.submitForApproval(actor, id);
  }

  @Post(':id/approve')
  @RequirePermissions(Permission.PURCHASE_ORDER_APPROVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a PO (release spend).' })
  approve(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.purchaseOrders.approve(actor, id);
  }

  @Post(':id/order')
  @RequirePermissions(Permission.PURCHASE_ORDER_APPROVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark an APPROVED PO as ORDERED (sent to vendor).' })
  markOrdered(@CurrentUser() actor: AuthPrincipal, @Param('id') id: string) {
    return this.purchaseOrders.markOrdered(actor, id);
  }

  @Post(':id/cancel')
  @RequirePermissions(Permission.PURCHASE_ORDER_CANCEL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a PO (only if no receipts posted).' })
  cancel(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: CancelPurchaseOrderDto,
  ) {
    return this.purchaseOrders.cancel(actor, id, dto);
  }

  @Post(':id/receipts')
  @RequirePermissions(Permission.PURCHASE_ORDER_RECEIVE)
  @ApiOperation({ summary: 'Post a Goods Receipt against an ORDERED PO.' })
  receive(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: CreateGoodsReceiptDto,
  ) {
    return this.purchaseOrders.receive(actor, id, dto);
  }
}
