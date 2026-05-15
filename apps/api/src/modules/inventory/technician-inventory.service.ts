/**
 * Technician inventory — the field-service spare bag.
 *
 * Lifecycle (per allocation row):
 *   ALLOCATED → ACKNOWLEDGED → USED → RETURNED → RECONCILED
 *
 * The ALLOCATION step moves stock out of a warehouse (OUT_TO_TECHNICIAN)
 * and creates a TechnicianInventory row carrying snapshots of cost / qty.
 *
 * USAGE records a partial consumption on a booking. We DO NOT debit the
 * warehouse again — the parts already left when allocated. We instead
 * update the row and (when a booking is provided) create an audit ledger
 * row referencing the booking + technician for traceability.
 *
 * RETURN bumps `returnedQty` and writes a IN_RETURN_TECHNICIAN ledger row
 * pushing the parts back into the source warehouse.
 *
 * RECONCILIATION marks the row as closed. If `usedQty + returnedQty <
 * allocatedQty` we record a shortfall and raise an alert so finance can
 * recover the cost from the technician.
 */

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  type BookingId,
  DomainEventName,
  InventoryAlertKind,
  InventoryAlertSeverity,
  StockMovementKind,
  type TechnicianId,
  TechnicianStockStatus,
} from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { DomainEventBus } from '../../common/events/domain-event-bus.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import type {
  AllocateStockDto,
  ListTechStockDto,
  ReconcileStockDto,
  ReturnStockDto,
  UseStockDto,
} from './dto/technician-inventory.dto';
import { InventoryLedgerService } from './inventory-ledger.service';

@Injectable()
export class TechnicianInventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: InventoryLedgerService,
    private readonly events: DomainEventBus,
  ) {}

  async allocate(actor: AuthPrincipal, dto: AllocateStockDto) {
    const technician = await this.prisma.client.technician.findFirst({
      where: { id: dto.technicianId, tenantId: actor.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!technician) throw new NotFoundException('Technician not found');
    const item = await this.prisma.client.inventoryItem.findFirst({
      where: { id: dto.itemId, tenantId: actor.tenantId, deletedAt: null },
      select: { id: true, costPriceMinor: true },
    });
    if (!item) throw new NotFoundException('Inventory item not found');
    const wh = await this.prisma.client.warehouse.findFirst({
      where: { id: dto.sourceWarehouseId, tenantId: actor.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!wh) throw new NotFoundException('Source warehouse not found');

    return this.prisma.client.$transaction(async (tx) => {
      const allocation = await tx.technicianInventory.create({
        data: {
          tenantId: actor.tenantId,
          technicianId: technician.id,
          itemId: item.id,
          sourceWarehouseId: wh.id,
          bookingId: dto.bookingId ?? null,
          status: TechnicianStockStatus.ALLOCATED,
          allocatedQty: dto.quantity,
          unitCostMinor: item.costPriceMinor,
          notes: dto.notes ?? null,
        },
      });
      await this.ledger.postInTx(tx, {
        tenantId: actor.tenantId,
        itemId: item.id,
        warehouseId: wh.id,
        kind: StockMovementKind.OUT_TO_TECHNICIAN,
        quantity: dto.quantity,
        unitCostMinor: item.costPriceMinor,
        technicianId: technician.id,
        technicianAllocationId: allocation.id,
        bookingId: dto.bookingId ?? null,
        description: `Allocated to technician ${technician.id}`,
        externalRef: `alloc:${allocation.id}:create`,
        createdBy: actor.userId,
      });
      this.events.publish(DomainEventName.TechnicianStockAllocated, {
        allocationId: allocation.id,
        technicianId: technician.id as TechnicianId,
        itemId: item.id,
        quantity: dto.quantity,
        bookingId: (dto.bookingId ?? null) as BookingId | null,
      });
      return allocation;
    });
  }

  async acknowledge(actor: AuthPrincipal, allocationId: string) {
    const row = await this.assertAllocation(actor.tenantId, allocationId);
    if (row.status !== TechnicianStockStatus.ALLOCATED) {
      throw new ConflictException('Only ALLOCATED rows can be acknowledged');
    }
    const updated = await this.prisma.client.technicianInventory.update({
      where: { id: row.id },
      data: { status: TechnicianStockStatus.ACKNOWLEDGED, acknowledgedAt: new Date() },
    });
    this.events.publish(DomainEventName.TechnicianStockAcknowledged, {
      allocationId: row.id,
      technicianId: row.technicianId as TechnicianId,
    });
    return updated;
  }

  async recordUsage(actor: AuthPrincipal, allocationId: string, dto: UseStockDto) {
    return this.prisma.client.$transaction(async (tx) => {
      const row = await tx.technicianInventory.findFirst({
        where: { id: allocationId, tenantId: actor.tenantId },
      });
      if (!row) throw new NotFoundException('Allocation not found');
      if (row.status === TechnicianStockStatus.RECONCILED) {
        throw new ConflictException('Allocation already reconciled');
      }
      if (row.usedQty + dto.usedQty + row.returnedQty > row.allocatedQty) {
        throw new BadRequestException('Usage exceeds remaining allocation');
      }

      const updated = await tx.technicianInventory.update({
        where: { id: row.id },
        data: {
          usedQty: { increment: dto.usedQty },
          bookingId: dto.bookingId ?? row.bookingId,
          status: TechnicianStockStatus.USED,
          usedAt: new Date(),
          notes: dto.notes ?? row.notes,
        },
      });

      // Audit row — no physical stock change (already debited at allocation).
      await this.ledger.postInTx(tx, {
        tenantId: actor.tenantId,
        itemId: row.itemId,
        warehouseId: row.sourceWarehouseId,
        kind: StockMovementKind.OUT_TO_BOOKING,
        quantity: 0, // zero physical delta — this is a trace row.
        bookingId: dto.bookingId ?? row.bookingId,
        technicianId: row.technicianId,
        technicianAllocationId: row.id,
        description: `Consumed on booking by technician ${row.technicianId}`,
        externalRef: `alloc:${row.id}:use:${dto.usedQty}:${Date.now()}`,
        createdBy: actor.userId,
        allowNegative: true,
      });

      this.events.publish(DomainEventName.TechnicianStockUsed, {
        allocationId: row.id,
        technicianId: row.technicianId as TechnicianId,
        itemId: row.itemId,
        usedQty: dto.usedQty,
        bookingId: (dto.bookingId ?? row.bookingId) as BookingId | null,
      });
      return updated;
    });
  }

  async returnStock(actor: AuthPrincipal, allocationId: string, dto: ReturnStockDto) {
    return this.prisma.client.$transaction(async (tx) => {
      const row = await tx.technicianInventory.findFirst({
        where: { id: allocationId, tenantId: actor.tenantId },
      });
      if (!row) throw new NotFoundException('Allocation not found');
      if (row.status === TechnicianStockStatus.RECONCILED) {
        throw new ConflictException('Allocation already reconciled');
      }
      if (row.usedQty + dto.returnedQty + row.returnedQty > row.allocatedQty) {
        throw new BadRequestException('Return exceeds remaining allocation');
      }
      const updated = await tx.technicianInventory.update({
        where: { id: row.id },
        data: {
          returnedQty: { increment: dto.returnedQty },
          status: TechnicianStockStatus.RETURNED,
          returnedAt: new Date(),
          notes: dto.notes ?? row.notes,
        },
      });
      await this.ledger.postInTx(tx, {
        tenantId: actor.tenantId,
        itemId: row.itemId,
        warehouseId: row.sourceWarehouseId,
        kind: StockMovementKind.IN_RETURN_TECHNICIAN,
        quantity: dto.returnedQty,
        unitCostMinor: row.unitCostMinor,
        technicianId: row.technicianId,
        technicianAllocationId: row.id,
        description: `Returned by technician ${row.technicianId}`,
        externalRef: `alloc:${row.id}:return:${dto.returnedQty}:${Date.now()}`,
        createdBy: actor.userId,
      });
      this.events.publish(DomainEventName.TechnicianStockReturned, {
        allocationId: row.id,
        technicianId: row.technicianId as TechnicianId,
        itemId: row.itemId,
        returnedQty: dto.returnedQty,
      });
      return updated;
    });
  }

  async reconcile(actor: AuthPrincipal, allocationId: string, dto: ReconcileStockDto) {
    return this.prisma.client.$transaction(async (tx) => {
      const row = await tx.technicianInventory.findFirst({
        where: { id: allocationId, tenantId: actor.tenantId },
      });
      if (!row) throw new NotFoundException('Allocation not found');
      if (row.status === TechnicianStockStatus.RECONCILED) return row;

      const shortfall = row.allocatedQty - row.usedQty - row.returnedQty;
      const updated = await tx.technicianInventory.update({
        where: { id: row.id },
        data: {
          status: TechnicianStockStatus.RECONCILED,
          reconciledAt: new Date(),
          notes: dto.notes ?? row.notes,
        },
      });

      if (shortfall > 0) {
        // Raise an alert that finance/dispatch can act on.
        await tx.inventoryAlert.create({
          data: {
            tenantId: actor.tenantId,
            kind: InventoryAlertKind.TECHNICIAN_MISMATCH,
            severity: InventoryAlertSeverity.WARNING,
            itemId: row.itemId,
            warehouseId: row.sourceWarehouseId,
            technicianId: row.technicianId,
            title: `Technician inventory shortfall: ${shortfall} unit(s)`,
            observedValue: shortfall,
            thresholdValue: 0,
            dedupeKey: `alloc:${row.id}:shortfall`,
          },
        });
      }
      this.events.publish(DomainEventName.TechnicianStockReconciled, {
        allocationId: row.id,
        technicianId: row.technicianId as TechnicianId,
        finalStatus: TechnicianStockStatus.RECONCILED,
        shortfallQty: Math.max(0, shortfall),
      });
      return updated;
    });
  }

  async list(actor: AuthPrincipal, dto: ListTechStockDto) {
    const where: Prisma.TechnicianInventoryWhereInput = {
      tenantId: actor.tenantId,
    };
    if (dto.technicianId) where.technicianId = dto.technicianId;
    if (dto.status) where.status = dto.status;
    if (dto.itemId) where.itemId = dto.itemId;
    if (dto.bookingId) where.bookingId = dto.bookingId;

    const [items, total] = await Promise.all([
      this.prisma.client.technicianInventory.findMany({
        where,
        orderBy: { allocatedAt: 'desc' },
        skip: dto.skip,
        take: dto.pageSize,
        include: {
          item: { select: { id: true, sku: true, name: true, unit: true } },
        },
      }),
      this.prisma.client.technicianInventory.count({ where }),
    ]);
    return { items, total, page: dto.page, pageSize: dto.pageSize };
  }

  /** Quick stock view for a technician's app — open allocations only. */
  async vanInventory(actor: AuthPrincipal, technicianId: string) {
    const where: Prisma.TechnicianInventoryWhereInput = {
      tenantId: actor.tenantId,
      technicianId,
      status: { in: [TechnicianStockStatus.ALLOCATED, TechnicianStockStatus.ACKNOWLEDGED, TechnicianStockStatus.USED] },
    };
    const rows = await this.prisma.client.technicianInventory.findMany({
      where,
      include: { item: { select: { id: true, sku: true, name: true, unit: true, sellingPriceMinor: true } } },
      orderBy: { allocatedAt: 'desc' },
    });
    return rows.map((r) => ({
      ...r,
      remainingQty: r.allocatedQty - r.usedQty - r.returnedQty,
    }));
  }

  // ---------------------------------------------------------------- internals
  private async assertAllocation(tenantId: string, id: string) {
    const row = await this.prisma.client.technicianInventory.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Allocation not found');
    return row;
  }
}
