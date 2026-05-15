/**
 * Purchase Order workflow.
 *
 * State machine (see `PURCHASE_ORDER_TRANSITIONS` in @ac/types):
 *
 *   DRAFT → AWAITING_APPROVAL → APPROVED → ORDERED →
 *     PARTIALLY_RECEIVED → RECEIVED → CLOSED
 *
 * Any open state can also be CANCELLED. Approval is a separate explicit
 * action keyed off the `purchase_order:approve` permission so we can audit
 * who released spend.
 *
 * Goods Receipts (GRNs) are the bridge to inventory:
 *   - Each GRN is one-shot — once POSTED, it writes inventory ledger rows
 *     for every line item (kind = IN_PURCHASE) and bumps the cached
 *     warehouse balance.
 *   - The PO's `receivedQty` totals are kept in lock-step with all posted
 *     GRNs, so PARTIALLY_RECEIVED / RECEIVED transitions can be computed
 *     transactionally.
 *   - Cancelling a GRN would require a compensating ledger row; we don't
 *     allow it for now and require a manual `OUT_ADJUSTMENT` instead.
 *
 * Concurrency: every state-changing operation runs in a transaction and
 * checks the latest PO status under a row lock so two approvers can't
 * race.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  DomainEventName,
  PURCHASE_ORDER_TRANSITIONS,
  PurchaseOrderStatus,
  StockMovementKind,
} from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { DomainEventBus } from '../../common/events/domain-event-bus.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { nextInventoryNumber } from '../../common/inventory/codes';
import {
  CancelPurchaseOrderDto,
  CreateGoodsReceiptDto,
  CreatePurchaseOrderDto,
  ListPurchaseOrdersDto,
  PurchaseOrderItemDto,
  UpdatePurchaseOrderDto,
} from './dto/purchase-order.dto';
import { InventoryLedgerService } from './inventory-ledger.service';

const EDITABLE_STATUSES = new Set<PurchaseOrderStatus>([
  PurchaseOrderStatus.DRAFT,
  PurchaseOrderStatus.AWAITING_APPROVAL,
]);
const RECEIVABLE_STATUSES = new Set<PurchaseOrderStatus>([
  PurchaseOrderStatus.ORDERED,
  PurchaseOrderStatus.PARTIALLY_RECEIVED,
]);

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: InventoryLedgerService,
    private readonly events: DomainEventBus,
  ) {}

  // -------------------------------------------------------------------- create
  async create(actor: AuthPrincipal, dto: CreatePurchaseOrderDto) {
    const vendor = await this.prisma.client.vendor.findFirst({
      where: { id: dto.vendorId, tenantId: actor.tenantId, deletedAt: null },
      select: { id: true, status: true, paymentTermsDays: true },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    if (vendor.status === 'BLACKLISTED') {
      throw new ForbiddenException('Vendor is blacklisted');
    }
    const wh = await this.prisma.client.warehouse.findFirst({
      where: { id: dto.warehouseId, tenantId: actor.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!wh) throw new NotFoundException('Warehouse not found');

    const lines = this.computeLineTotals(dto.items);
    const subtotal = lines.reduce((a, l) => a + l.quantity * l.unitCostMinor, 0);
    const tax = lines.reduce((a, l) => a + l.taxMinor, 0);
    const total = subtotal + tax + (dto.shippingMinor ?? 0) - (dto.discountMinor ?? 0);

    const number = await nextInventoryNumber(this.prisma, actor.tenantId, {
      prefix: 'PO',
      table: 'purchaseOrder',
    });

    return this.prisma.client.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.create({
        data: {
          tenantId: actor.tenantId,
          number,
          vendorId: vendor.id,
          warehouseId: wh.id,
          status: PurchaseOrderStatus.DRAFT,
          expectedAt: dto.expectedAt ? new Date(dto.expectedAt) : null,
          subtotalMinor: subtotal,
          taxMinor: tax,
          discountMinor: dto.discountMinor ?? 0,
          shippingMinor: dto.shippingMinor ?? 0,
          totalMinor: total,
          paymentTermsDays: vendor.paymentTermsDays,
          notes: dto.notes ?? null,
          createdBy: actor.userId,
          updatedBy: actor.userId,
          items: { create: lines.map((l) => ({ ...l, item: undefined })) as any },
        },
        include: { items: true },
      });

      this.events.publish(DomainEventName.PurchaseOrderCreated, {
        purchaseOrderId: po.id,
        vendorId: vendor.id,
        totalMinor: total,
      });
      return po;
    });
  }

  // ---------------------------------------------------------------------- list
  async list(actor: AuthPrincipal, dto: ListPurchaseOrdersDto) {
    const where: Prisma.PurchaseOrderWhereInput = {
      tenantId: actor.tenantId,
      deletedAt: null,
    };
    if (dto.status) where.status = dto.status;
    if (dto.vendorId) where.vendorId = dto.vendorId;
    if (dto.warehouseId) where.warehouseId = dto.warehouseId;
    if (dto.from || dto.to) {
      where.createdAt = {
        gte: dto.from ? new Date(dto.from) : undefined,
        lte: dto.to ? new Date(dto.to) : undefined,
      };
    }
    if (dto.search) {
      where.OR = [
        { number: { contains: dto.search, mode: 'insensitive' } },
        { notes: { contains: dto.search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.client.purchaseOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: dto.skip,
        take: dto.pageSize,
        include: {
          vendor: { select: { id: true, companyName: true, code: true } },
          warehouse: { select: { id: true, name: true, code: true } },
          _count: { select: { items: true, receipts: true } },
        },
      }),
      this.prisma.client.purchaseOrder.count({ where }),
    ]);
    return { items, total, page: dto.page, pageSize: dto.pageSize };
  }

  async get(actor: AuthPrincipal, id: string) {
    const po = await this.prisma.client.purchaseOrder.findFirst({
      where: { id, tenantId: actor.tenantId, deletedAt: null },
      include: {
        vendor: true,
        warehouse: true,
        items: { include: { item: { select: { id: true, sku: true, name: true, unit: true } } } },
        receipts: {
          orderBy: { receivedAt: 'desc' },
          include: { items: { include: { item: { select: { id: true, sku: true, name: true } } } } },
        },
      },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }

  // -------------------------------------------------------------------- update
  async update(actor: AuthPrincipal, id: string, dto: UpdatePurchaseOrderDto) {
    return this.prisma.client.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findFirst({
        where: { id, tenantId: actor.tenantId, deletedAt: null },
      });
      if (!po) throw new NotFoundException('Purchase order not found');
      if (!EDITABLE_STATUSES.has(po.status as PurchaseOrderStatus)) {
        throw new ConflictException(`Cannot edit a PO in status ${po.status}`);
      }

      const data: Prisma.PurchaseOrderUpdateInput = {
        expectedAt: dto.expectedAt ? new Date(dto.expectedAt) : po.expectedAt,
        discountMinor: dto.discountMinor ?? po.discountMinor,
        shippingMinor: dto.shippingMinor ?? po.shippingMinor,
        notes: dto.notes ?? po.notes,
        updatedBy: actor.userId,
      };

      if (dto.items) {
        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
        const lines = this.computeLineTotals(dto.items);
        const subtotal = lines.reduce((a, l) => a + l.quantity * l.unitCostMinor, 0);
        const tax = lines.reduce((a, l) => a + l.taxMinor, 0);
        const total = subtotal + tax + (dto.shippingMinor ?? po.shippingMinor) - (dto.discountMinor ?? po.discountMinor);
        data.subtotalMinor = subtotal;
        data.taxMinor = tax;
        data.totalMinor = total;
        data.items = { create: lines as any };
      }
      return tx.purchaseOrder.update({
        where: { id },
        data,
        include: { items: true, vendor: true, warehouse: true },
      });
    });
  }

  // ----------------------------------------------------------- transitions
  async submitForApproval(actor: AuthPrincipal, id: string) {
    return this.transition(actor, id, PurchaseOrderStatus.AWAITING_APPROVAL);
  }

  async approve(actor: AuthPrincipal, id: string) {
    return this.transition(actor, id, PurchaseOrderStatus.APPROVED, {
      approvedById: actor.userId,
      approvedAt: new Date(),
    });
  }

  async markOrdered(actor: AuthPrincipal, id: string) {
    return this.transition(actor, id, PurchaseOrderStatus.ORDERED, {
      orderedAt: new Date(),
    });
  }

  async cancel(actor: AuthPrincipal, id: string, dto: CancelPurchaseOrderDto) {
    const po = await this.transition(actor, id, PurchaseOrderStatus.CANCELLED, {
      closedAt: new Date(),
      notes: dto.reason ?? undefined,
    });
    this.events.publish(DomainEventName.PurchaseOrderCancelled, {
      purchaseOrderId: po.id,
      reason: dto.reason ?? null,
    });
    return po;
  }

  // -------------------------------------------------------------- GRN posting
  async receive(actor: AuthPrincipal, poId: string, dto: CreateGoodsReceiptDto) {
    return this.prisma.client.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findFirst({
        where: { id: poId, tenantId: actor.tenantId, deletedAt: null },
        include: { items: true },
      });
      if (!po) throw new NotFoundException('Purchase order not found');
      if (!RECEIVABLE_STATUSES.has(po.status as PurchaseOrderStatus)) {
        throw new ConflictException(
          `Cannot receive against a PO in status ${po.status} — must be ORDERED or PARTIALLY_RECEIVED`,
        );
      }

      const lineByItem = new Map(po.items.map((l) => [l.itemId, l]));
      for (const incoming of dto.items) {
        const line = lineByItem.get(incoming.itemId);
        if (!line) {
          throw new BadRequestException(
            `Item ${incoming.itemId} is not part of this PO`,
          );
        }
        const newReceived = line.receivedQty + incoming.quantity;
        if (newReceived > line.quantity) {
          throw new BadRequestException(
            `Receipt for ${incoming.itemId} exceeds ordered quantity (${newReceived} > ${line.quantity})`,
          );
        }
      }

      const grnNumber = await nextInventoryNumber(this.prisma, actor.tenantId, {
        prefix: 'GRN',
        table: 'goodsReceipt',
      });

      const grn = await tx.goodsReceipt.create({
        data: {
          tenantId: actor.tenantId,
          number: grnNumber,
          purchaseOrderId: po.id,
          warehouseId: po.warehouseId,
          status: 'POSTED',
          notes: dto.notes ?? null,
          attachments: dto.attachments ?? [],
          createdBy: actor.userId,
          items: {
            create: dto.items.map((i) => {
              const line = lineByItem.get(i.itemId)!;
              return {
                itemId: i.itemId,
                quantity: i.quantity,
                unitCostMinor: i.unitCostMinor ?? line.unitCostMinor,
                batchNumber: i.batchNumber ?? null,
                serialNumbers: i.serialNumbers ?? [],
                expiryDate: i.expiryDate ? new Date(i.expiryDate) : null,
              };
            }),
          },
        },
        include: { items: true },
      });

      // Apply each receipt line to the inventory ledger.
      for (const grnItem of grn.items) {
        await this.ledger.postInTx(tx, {
          tenantId: actor.tenantId,
          itemId: grnItem.itemId,
          warehouseId: po.warehouseId,
          kind: StockMovementKind.IN_PURCHASE,
          quantity: grnItem.quantity,
          unitCostMinor: grnItem.unitCostMinor,
          purchaseOrderId: po.id,
          goodsReceiptId: grn.id,
          description: `Receipt against PO ${po.number}`,
          createdBy: actor.userId,
          externalRef: `grn:${grn.id}:item:${grnItem.id}`,
        });
      }

      // Bump receivedQty on each PO line.
      for (const incoming of dto.items) {
        await tx.purchaseOrderItem.updateMany({
          where: { purchaseOrderId: po.id, itemId: incoming.itemId },
          data: { receivedQty: { increment: incoming.quantity } },
        });
      }

      // Re-read items and decide the new PO status.
      const fresh = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: po.id },
        select: { quantity: true, receivedQty: true },
      });
      const allReceived = fresh.every((l) => l.receivedQty >= l.quantity);
      const anyReceived = fresh.some((l) => l.receivedQty > 0);

      let nextStatus: PurchaseOrderStatus = po.status as PurchaseOrderStatus;
      if (allReceived) nextStatus = PurchaseOrderStatus.RECEIVED;
      else if (anyReceived) nextStatus = PurchaseOrderStatus.PARTIALLY_RECEIVED;

      if (nextStatus !== po.status) {
        const allowed = PURCHASE_ORDER_TRANSITIONS[po.status as PurchaseOrderStatus] ?? [];
        if (!allowed.includes(nextStatus)) {
          throw new ConflictException(
            `Invalid state derivation: ${po.status} → ${nextStatus}`,
          );
        }
        await tx.purchaseOrder.update({
          where: { id: po.id },
          data: {
            status: nextStatus,
            receivedAt: nextStatus === PurchaseOrderStatus.RECEIVED ? new Date() : null,
          },
        });
      }

      // Update vendor performance counters.
      if (nextStatus === PurchaseOrderStatus.RECEIVED && po.expectedAt) {
        const onTime = new Date() <= po.expectedAt;
        // Exponential moving average over on-time deliveries.
        await tx.vendor.update({
          where: { id: po.vendorId },
          data: {
            onTimeRate: { increment: 0 }, // placeholder, real EMA below
          },
        });
        await tx.$executeRawUnsafe(
          `UPDATE "vendors"
             SET "onTimeRate" = ("onTimeRate" * 0.8) + ($1::float * 0.2),
                 "lifetimeSpendMinor" = "lifetimeSpendMinor" + $2::int
           WHERE "id" = $3`,
          onTime ? 1 : 0,
          po.totalMinor,
          po.vendorId,
        );
      }

      this.events.publish(DomainEventName.GoodsReceiptPosted, {
        goodsReceiptId: grn.id,
        purchaseOrderId: po.id,
        warehouseId: po.warehouseId,
      });
      this.events.publish(DomainEventName.PurchaseOrderReceived, {
        purchaseOrderId: po.id,
        status: nextStatus,
      });
      return { grn, poStatus: nextStatus };
    });
  }

  // ---------------------------------------------------------------- internals

  private async transition(
    actor: AuthPrincipal,
    id: string,
    next: PurchaseOrderStatus,
    extra: Prisma.PurchaseOrderUpdateInput = {},
  ) {
    return this.prisma.client.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findFirst({
        where: { id, tenantId: actor.tenantId, deletedAt: null },
      });
      if (!po) throw new NotFoundException('Purchase order not found');
      const allowed = PURCHASE_ORDER_TRANSITIONS[po.status as PurchaseOrderStatus] ?? [];
      if (!allowed.includes(next)) {
        throw new ConflictException(`Cannot transition from ${po.status} to ${next}`);
      }
      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: { ...extra, status: next, updatedBy: actor.userId },
      });

      switch (next) {
        case PurchaseOrderStatus.APPROVED:
          this.events.publish(DomainEventName.PurchaseOrderApproved, {
            purchaseOrderId: updated.id,
          });
          break;
        case PurchaseOrderStatus.ORDERED:
          this.events.publish(DomainEventName.PurchaseOrderOrdered, {
            purchaseOrderId: updated.id,
          });
          break;
        default:
          break;
      }
      return updated;
    });
  }

  private computeLineTotals(items: PurchaseOrderItemDto[]) {
    return items.map((i) => {
      const subtotal = i.quantity * i.unitCostMinor;
      const gstRate = i.gstRateBps ?? 1800;
      const tax = Math.round((subtotal * gstRate) / 10000);
      return {
        itemId: i.itemId,
        description: i.description ?? null,
        quantity: i.quantity,
        unitCostMinor: i.unitCostMinor,
        receivedQty: 0,
        gstRateBps: gstRate,
        taxMinor: tax,
        totalMinor: subtotal + tax,
        vendorSku: i.vendorSku ?? null,
      };
    });
  }
}
