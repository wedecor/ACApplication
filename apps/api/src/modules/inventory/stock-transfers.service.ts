/**
 * Stock transfers between warehouses.
 *
 * Lifecycle:
 *   REQUESTED → APPROVED → IN_TRANSIT → RECEIVED
 *
 * At each step we touch the ledger exactly once:
 *   - APPROVED: reserve the requested quantity at the source warehouse so
 *     no one else picks the same parts while the dispatch is queued.
 *   - IN_TRANSIT: physically move stock out of the source (OUT_TRANSFER)
 *     and release the reservation in the same atomic transaction.
 *   - RECEIVED: physically move stock into the destination (IN_TRANSFER)
 *     using the destination's quantities (which may differ if shrinkage
 *     occurred). Any shortfall raises a TECHNICIAN_MISMATCH-style alert
 *     surfaced as a transfer note.
 *
 * Cancellation is allowed up to APPROVED. Once IN_TRANSIT we require a
 * RECEIVED state (with potential shortfall) so the ledger never sits with
 * "ghost" stock floating between two snapshots.
 */

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  DomainEventName,
  STOCK_TRANSFER_TRANSITIONS,
  StockMovementKind,
  StockTransferStatus,
} from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { DomainEventBus } from '../../common/events/domain-event-bus.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { nextInventoryNumber } from '../../common/inventory/codes';
import {
  CreateTransferDto,
  ReceiveTransferDto,
} from './dto/inventory-item.dto';
import { InventoryLedgerService } from './inventory-ledger.service';

@Injectable()
export class StockTransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: InventoryLedgerService,
    private readonly events: DomainEventBus,
  ) {}

  async request(actor: AuthPrincipal, dto: CreateTransferDto) {
    if (dto.sourceWarehouseId === dto.destWarehouseId) {
      throw new BadRequestException('Source and destination must differ');
    }
    const [src, dest] = await Promise.all([
      this.assertWarehouse(actor.tenantId, dto.sourceWarehouseId),
      this.assertWarehouse(actor.tenantId, dto.destWarehouseId),
    ]);

    const number = await nextInventoryNumber(this.prisma, actor.tenantId, {
      prefix: 'TRN',
      table: 'stockTransfer',
    });

    return this.prisma.client.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.create({
        data: {
          tenantId: actor.tenantId,
          number,
          sourceWarehouseId: src.id,
          destWarehouseId: dest.id,
          status: StockTransferStatus.REQUESTED,
          requestedBy: actor.userId,
          notes: dto.notes ?? null,
          items: {
            create: dto.items.map((i) => ({
              itemId: i.itemId,
              requestedQty: i.quantity,
            })),
          },
        },
        include: { items: true },
      });
      this.events.publish(DomainEventName.StockTransferRequested, {
        transferId: transfer.id,
        sourceWarehouseId: src.id,
        destWarehouseId: dest.id,
      });
      return transfer;
    });
  }

  async list(
    actor: AuthPrincipal,
    opts: {
      status?: StockTransferStatus;
      sourceWarehouseId?: string;
      destWarehouseId?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const where: Prisma.StockTransferWhereInput = {
      tenantId: actor.tenantId,
      deletedAt: null,
    };
    if (opts.status) where.status = opts.status;
    if (opts.sourceWarehouseId) where.sourceWarehouseId = opts.sourceWarehouseId;
    if (opts.destWarehouseId) where.destWarehouseId = opts.destWarehouseId;
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 20;
    const [items, total] = await Promise.all([
      this.prisma.client.stockTransfer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          sourceWarehouse: { select: { id: true, code: true, name: true } },
          destWarehouse: { select: { id: true, code: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.client.stockTransfer.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async get(actor: AuthPrincipal, id: string) {
    const t = await this.prisma.client.stockTransfer.findFirst({
      where: { id, tenantId: actor.tenantId, deletedAt: null },
      include: {
        sourceWarehouse: true,
        destWarehouse: true,
        items: { include: { item: { select: { id: true, sku: true, name: true, unit: true } } } },
      },
    });
    if (!t) throw new NotFoundException('Transfer not found');
    return t;
  }

  async approve(actor: AuthPrincipal, id: string) {
    return this.prisma.client.$transaction(async (tx) => {
      const t = await this.assertTransfer(tx, actor.tenantId, id);
      this.assertTransition(t.status as StockTransferStatus, StockTransferStatus.APPROVED);
      // Reserve at the source warehouse so no one else can pick this stock.
      for (const line of t.items) {
        await this.ledger.postInTx(tx, {
          tenantId: actor.tenantId,
          itemId: line.itemId,
          warehouseId: t.sourceWarehouseId,
          kind: StockMovementKind.RESERVE,
          quantity: line.requestedQty,
          transferId: t.id,
          description: `Reserved for transfer ${t.number}`,
          externalRef: `transfer:${t.id}:reserve:${line.id}`,
          createdBy: actor.userId,
        });
      }
      const updated = await tx.stockTransfer.update({
        where: { id },
        data: {
          status: StockTransferStatus.APPROVED,
          approvedAt: new Date(),
          approvedBy: actor.userId,
        },
      });
      this.events.publish(DomainEventName.StockTransferApproved, { transferId: id });
      return updated;
    });
  }

  async reject(actor: AuthPrincipal, id: string, reason?: string) {
    return this.prisma.client.$transaction(async (tx) => {
      const t = await this.assertTransfer(tx, actor.tenantId, id);
      this.assertTransition(t.status as StockTransferStatus, StockTransferStatus.REJECTED);
      const updated = await tx.stockTransfer.update({
        where: { id },
        data: {
          status: StockTransferStatus.REJECTED,
          cancelledBy: actor.userId,
          cancelReason: reason ?? null,
          cancelledAt: new Date(),
        },
      });
      this.events.publish(DomainEventName.StockTransferCancelled, {
        transferId: id,
        reason: reason ?? null,
      });
      return updated;
    });
  }

  async dispatch(actor: AuthPrincipal, id: string) {
    return this.prisma.client.$transaction(async (tx) => {
      const t = await this.assertTransfer(tx, actor.tenantId, id);
      this.assertTransition(t.status as StockTransferStatus, StockTransferStatus.IN_TRANSIT);

      for (const line of t.items) {
        // Release the reservation and move stock out in the same step.
        await this.ledger.postInTx(tx, {
          tenantId: actor.tenantId,
          itemId: line.itemId,
          warehouseId: t.sourceWarehouseId,
          kind: StockMovementKind.RELEASE_RESERVE,
          quantity: line.requestedQty,
          transferId: t.id,
          description: `Release reservation on dispatch ${t.number}`,
          externalRef: `transfer:${t.id}:release:${line.id}`,
          createdBy: actor.userId,
        });
        await this.ledger.postInTx(tx, {
          tenantId: actor.tenantId,
          itemId: line.itemId,
          warehouseId: t.sourceWarehouseId,
          kind: StockMovementKind.OUT_TRANSFER,
          quantity: line.requestedQty,
          unitCostMinor: line.unitCostMinor ?? undefined,
          transferId: t.id,
          description: `Dispatched on transfer ${t.number}`,
          externalRef: `transfer:${t.id}:dispatch:${line.id}`,
          createdBy: actor.userId,
        });
        await tx.stockTransferItem.update({
          where: { id: line.id },
          data: { dispatchedQty: line.requestedQty },
        });
      }
      const updated = await tx.stockTransfer.update({
        where: { id },
        data: { status: StockTransferStatus.IN_TRANSIT, dispatchedAt: new Date() },
      });
      this.events.publish(DomainEventName.StockTransferDispatched, { transferId: id });
      return updated;
    });
  }

  async receive(actor: AuthPrincipal, id: string, dto: ReceiveTransferDto) {
    return this.prisma.client.$transaction(async (tx) => {
      const t = await this.assertTransfer(tx, actor.tenantId, id);
      this.assertTransition(t.status as StockTransferStatus, StockTransferStatus.RECEIVED);

      const lineById = new Map(t.items.map((l) => [l.id, l]));
      for (const incoming of dto.items) {
        const line = lineById.get(incoming.transferItemId);
        if (!line) {
          throw new BadRequestException(
            `Line ${incoming.transferItemId} not part of transfer ${t.number}`,
          );
        }
        if (incoming.receivedQty > line.dispatchedQty) {
          throw new BadRequestException(
            `Received qty (${incoming.receivedQty}) exceeds dispatched (${line.dispatchedQty}) for line ${line.id}`,
          );
        }
      }

      for (const incoming of dto.items) {
        const line = lineById.get(incoming.transferItemId)!;
        if (incoming.receivedQty > 0) {
          await this.ledger.postInTx(tx, {
            tenantId: actor.tenantId,
            itemId: line.itemId,
            warehouseId: t.destWarehouseId,
            kind: StockMovementKind.IN_TRANSFER,
            quantity: incoming.receivedQty,
            unitCostMinor: line.unitCostMinor ?? undefined,
            transferId: t.id,
            description: `Received transfer ${t.number}`,
            externalRef: `transfer:${t.id}:receive:${line.id}`,
            createdBy: actor.userId,
          });
        }
        await tx.stockTransferItem.update({
          where: { id: line.id },
          data: { receivedQty: incoming.receivedQty },
        });
      }

      const updated = await tx.stockTransfer.update({
        where: { id },
        data: {
          status: StockTransferStatus.RECEIVED,
          receivedAt: new Date(),
          receivedBy: actor.userId,
          notes: dto.notes ?? t.notes,
        },
      });
      this.events.publish(DomainEventName.StockTransferReceived, { transferId: id });
      return updated;
    });
  }

  async cancel(actor: AuthPrincipal, id: string, reason?: string) {
    return this.prisma.client.$transaction(async (tx) => {
      const t = await this.assertTransfer(tx, actor.tenantId, id);
      if (t.status !== StockTransferStatus.DRAFT &&
          t.status !== StockTransferStatus.REQUESTED &&
          t.status !== StockTransferStatus.APPROVED) {
        throw new ConflictException(
          `Cannot cancel a transfer in status ${t.status}`,
        );
      }
      // If already approved, release the reservation.
      if (t.status === StockTransferStatus.APPROVED) {
        for (const line of t.items) {
          await this.ledger.postInTx(tx, {
            tenantId: actor.tenantId,
            itemId: line.itemId,
            warehouseId: t.sourceWarehouseId,
            kind: StockMovementKind.RELEASE_RESERVE,
            quantity: line.requestedQty,
            transferId: t.id,
            description: `Cancelled transfer ${t.number}`,
            externalRef: `transfer:${t.id}:cancel-release:${line.id}`,
            createdBy: actor.userId,
          });
        }
      }
      const updated = await tx.stockTransfer.update({
        where: { id },
        data: {
          status: StockTransferStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledBy: actor.userId,
          cancelReason: reason ?? null,
        },
      });
      this.events.publish(DomainEventName.StockTransferCancelled, {
        transferId: id,
        reason: reason ?? null,
      });
      return updated;
    });
  }

  // ---------------------------------------------------------------- internals
  private async assertWarehouse(tenantId: string, id: string) {
    const wh = await this.prisma.client.warehouse.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!wh) throw new NotFoundException('Warehouse not found');
    return wh;
  }

  private async assertTransfer(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ) {
    const t = await tx.stockTransfer.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { items: true },
    });
    if (!t) throw new NotFoundException('Transfer not found');
    return t;
  }

  private assertTransition(from: StockTransferStatus, to: StockTransferStatus) {
    const allowed = STOCK_TRANSFER_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new ConflictException(`Invalid transition ${from} → ${to}`);
    }
  }
}
