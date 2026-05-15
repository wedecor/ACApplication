/**
 * Inventory Ledger.
 *
 * Every stock movement — whether it originates from a purchase receipt,
 * a transfer, a technician allocation, a booking consumption, a scrap
 * write-off or a manual adjustment — funnels through `post()` and writes
 * exactly one immutable row to `inventory_ledger`.
 *
 * Correctness invariants:
 *  1. Rows are append-only. No UPDATE, no DELETE.
 *  2. `runningQuantity` / `runningReserved` are snapshots of the warehouse
 *     stock AFTER this movement was applied, recorded under a row-lock so
 *     concurrent writers can't pick the same prior balance.
 *  3. The denormalised `WarehouseStock` row is mutated inside the same
 *     transaction so the ledger and the snapshot can never diverge.
 *  4. `externalRef` provides per-tenant idempotency. Re-running a
 *     bookkeeping job that emits the same `externalRef` is a no-op — the
 *     existing row is returned with `skipped: true`.
 *  5. We emit an `InventoryStockUpdated` domain event after a successful
 *     post so realtime, alerts and analytics can react.
 *
 * Concurrency model:
 *  - All work runs in `prisma.$transaction`.
 *  - We acquire a Postgres row-lock on the (warehouse, item) snapshot via
 *    `SELECT … FOR UPDATE` so two writers can't simultaneously read the
 *    same `quantity`.
 *  - Callers may pass an outer `TransactionClient` (e.g. when wrapping a
 *    PO receipt) so nested operations participate in the same transaction.
 */

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  DomainEventName,
  STOCK_INFLOW_KINDS,
  STOCK_OUTFLOW_KINDS,
  StockMovementKind,
} from '@ac/types';

import { DomainEventBus } from '../../common/events/domain-event-bus.service';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface PostLedgerInput {
  tenantId: string;
  itemId: string;
  warehouseId: string;
  kind: StockMovementKind;
  /** Absolute movement size in pieces. Always > 0 for physical movements. */
  quantity: number;
  unitCostMinor?: number;
  /** Source references — set at most one set per ledger row. */
  purchaseOrderId?: string | null;
  goodsReceiptId?: string | null;
  transferId?: string | null;
  bookingId?: string | null;
  invoiceId?: string | null;
  technicianId?: string | null;
  technicianAllocationId?: string | null;
  adjustmentReason?: string | null;
  description?: string | null;
  /** Per-tenant idempotency token. */
  externalRef?: string;
  occurredAt?: Date;
  createdBy?: string | null;
  /**
   * If true, allow stock to go negative (used by careful adjustments). For
   * normal flows we reject negative stock to surface the bug at the boundary
   * rather than at the ledger.
   */
  allowNegative?: boolean;
}

export interface LedgerPostResult {
  id: string;
  runningQuantity: number;
  runningReserved: number;
  skipped: boolean;
}

@Injectable()
export class InventoryLedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventBus,
  ) {}

  /**
   * Post a single ledger row. Callers should prefer the higher-level
   * helpers on `InventoryService` (receivePurchase, adjustStock, transfer,
   * etc.) which build the appropriate `kind` and references. This raw entry
   * point is exposed for the booking / dispatch integrations that wire
   * directly into the ledger.
   */
  async post(
    input: PostLedgerInput,
    tx?: Prisma.TransactionClient,
  ): Promise<LedgerPostResult> {
    if (input.quantity == null) {
      throw new BadRequestException('Quantity is required');
    }
    if (this.requiresPhysicalQuantity(input.kind) && input.quantity <= 0) {
      throw new BadRequestException(
        `Quantity must be positive for movement ${input.kind}`,
      );
    }
    if (
      (input.kind === StockMovementKind.RESERVE ||
        input.kind === StockMovementKind.RELEASE_RESERVE) &&
      input.quantity <= 0
    ) {
      throw new BadRequestException('Reservation quantity must be positive');
    }

    const run = async (client: Prisma.TransactionClient) =>
      this.runInTx(client, input);

    return tx ? run(tx) : this.prisma.client.$transaction(run);
  }

  /** Convenience helper for callers that already hold a transactional client. */
  async postInTx(
    tx: Prisma.TransactionClient,
    input: PostLedgerInput,
  ): Promise<LedgerPostResult> {
    return this.runInTx(tx, input);
  }

  /**
   * Sum movements in a window to support analytics / reconciliation.
   * Reads the ledger directly (not the snapshot) so we never under-count
   * historical movements.
   */
  async sumMovements(opts: {
    tenantId: string;
    itemId?: string;
    warehouseId?: string;
    kinds?: StockMovementKind[];
    from?: Date;
    to?: Date;
  }): Promise<{ inflow: number; outflow: number; net: number }> {
    const rows = await this.prisma.client.inventoryLedger.findMany({
      where: {
        tenantId: opts.tenantId,
        itemId: opts.itemId,
        warehouseId: opts.warehouseId,
        kind: opts.kinds ? { in: opts.kinds } : undefined,
        occurredAt: opts.from || opts.to ? { gte: opts.from, lte: opts.to } : undefined,
      },
      select: { quantityDelta: true, kind: true },
    });
    let inflow = 0;
    let outflow = 0;
    for (const r of rows) {
      if (r.quantityDelta > 0) inflow += r.quantityDelta;
      else if (r.quantityDelta < 0) outflow += Math.abs(r.quantityDelta);
    }
    return { inflow, outflow, net: inflow - outflow };
  }

  // ------------------------------------------------------------------ internal

  private async runInTx(
    tx: Prisma.TransactionClient,
    input: PostLedgerInput,
  ): Promise<LedgerPostResult> {
    if (input.externalRef) {
      const existing = await tx.inventoryLedger.findUnique({
        where: {
          tenantId_externalRef: {
            tenantId: input.tenantId,
            externalRef: input.externalRef,
          },
        },
        select: { id: true, runningQuantity: true, runningReserved: true },
      });
      if (existing) {
        return {
          id: existing.id,
          runningQuantity: existing.runningQuantity,
          runningReserved: existing.runningReserved,
          skipped: true,
        };
      }
    }

    // Row-lock the snapshot so concurrent writers serialise.
    await tx.$executeRaw`
      SELECT id FROM "warehouse_stocks"
      WHERE "warehouseId" = ${input.warehouseId} AND "itemId" = ${input.itemId}
      FOR UPDATE
    `;

    let snapshot = await tx.warehouseStock.findUnique({
      where: { warehouseId_itemId: { warehouseId: input.warehouseId, itemId: input.itemId } },
      select: { id: true, quantity: true, reservedQuantity: true, avgCostMinor: true },
    });
    if (!snapshot) {
      // Auto-create a zero-balance snapshot so brand-new items receive
      // their first movement cleanly.
      const item = await tx.inventoryItem.findFirst({
        where: { id: input.itemId, tenantId: input.tenantId },
        select: { id: true, costPriceMinor: true },
      });
      if (!item) throw new NotFoundException('Inventory item not found');
      const warehouse = await tx.warehouse.findFirst({
        where: { id: input.warehouseId, tenantId: input.tenantId },
        select: { id: true },
      });
      if (!warehouse) throw new NotFoundException('Warehouse not found');
      snapshot = await tx.warehouseStock.create({
        data: {
          tenantId: input.tenantId,
          warehouseId: input.warehouseId,
          itemId: input.itemId,
          quantity: 0,
          reservedQuantity: 0,
          avgCostMinor: item.costPriceMinor ?? 0,
        },
        select: { id: true, quantity: true, reservedQuantity: true, avgCostMinor: true },
      });
    }

    const physicalDelta = this.physicalDelta(input.kind, input.quantity);
    const reservationDelta = this.reservationDelta(input.kind, input.quantity);

    const nextQuantity = snapshot.quantity + physicalDelta;
    const nextReserved = snapshot.reservedQuantity + reservationDelta;

    if (!input.allowNegative && nextQuantity < 0) {
      throw new ConflictException(
        `Movement would drive on-hand below zero (current ${snapshot.quantity}, delta ${physicalDelta})`,
      );
    }
    if (nextReserved < 0) {
      throw new ConflictException(
        `Cannot release more than currently reserved (current ${snapshot.reservedQuantity}, delta ${reservationDelta})`,
      );
    }
    // Available physical = quantity - reserved. We allow reservations to
    // walk up to the available stock; never beyond.
    if (
      input.kind === StockMovementKind.RESERVE &&
      nextReserved > nextQuantity
    ) {
      throw new ConflictException(
        `Insufficient stock to reserve (available ${snapshot.quantity - snapshot.reservedQuantity})`,
      );
    }

    const unitCost =
      input.unitCostMinor ??
      (physicalDelta > 0 ? snapshot.avgCostMinor : snapshot.avgCostMinor);
    const newAvgCost = this.computeWeightedAvg({
      currentQty: snapshot.quantity,
      currentAvgMinor: snapshot.avgCostMinor,
      deltaQty: physicalDelta,
      deltaUnitMinor: unitCost,
    });

    await tx.warehouseStock.update({
      where: { id: snapshot.id },
      data: {
        quantity: nextQuantity,
        reservedQuantity: nextReserved,
        avgCostMinor: newAvgCost,
        lastMovementAt: input.occurredAt ?? new Date(),
      },
    });

    if (physicalDelta > 0 && unitCost !== snapshot.avgCostMinor) {
      // Keep the catalogue's standard cost loosely in sync with weighted
      // average so reports + reorder math stay aligned. We don't touch
      // sellingPrice — that's a merchandising decision.
      await tx.inventoryItem.updateMany({
        where: { id: input.itemId, tenantId: input.tenantId },
        data: { costPriceMinor: newAvgCost },
      });
    }

    const row = await tx.inventoryLedger.create({
      data: {
        tenantId: input.tenantId,
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        kind: input.kind,
        quantityDelta: physicalDelta + reservationDelta * 0, // reservations have zero physical delta
        runningQuantity: nextQuantity,
        runningReserved: nextReserved,
        unitCostMinor: unitCost,
        purchaseOrderId: input.purchaseOrderId ?? null,
        goodsReceiptId: input.goodsReceiptId ?? null,
        transferId: input.transferId ?? null,
        bookingId: input.bookingId ?? null,
        invoiceId: input.invoiceId ?? null,
        technicianId: input.technicianId ?? null,
        technicianAllocationId: input.technicianAllocationId ?? null,
        adjustmentReason: input.adjustmentReason ?? null,
        description: input.description ?? null,
        externalRef: input.externalRef ?? null,
        occurredAt: input.occurredAt ?? new Date(),
        createdBy: input.createdBy ?? null,
      },
      select: { id: true },
    });

    this.events.publish(DomainEventName.InventoryStockUpdated, {
      itemId: input.itemId,
      warehouseId: input.warehouseId,
      kind: input.kind,
      quantityDelta: physicalDelta,
      runningQuantity: nextQuantity,
      runningReserved: nextReserved,
    });

    return {
      id: row.id,
      runningQuantity: nextQuantity,
      runningReserved: nextReserved,
      skipped: false,
    };
  }

  private requiresPhysicalQuantity(kind: StockMovementKind): boolean {
    return (
      STOCK_INFLOW_KINDS.has(kind) ||
      STOCK_OUTFLOW_KINDS.has(kind)
    );
  }

  private physicalDelta(kind: StockMovementKind, qty: number): number {
    if (STOCK_INFLOW_KINDS.has(kind)) return qty;
    if (STOCK_OUTFLOW_KINDS.has(kind)) return -qty;
    return 0;
  }

  private reservationDelta(kind: StockMovementKind, qty: number): number {
    if (kind === StockMovementKind.RESERVE) return qty;
    if (kind === StockMovementKind.RELEASE_RESERVE) return -qty;
    // When stock is issued to a technician or consumed by a booking the
    // physical inventory drops AND the previously held reservation is
    // released. Callers signal this by posting a RELEASE_RESERVE row in
    // the same transaction; the ledger never auto-releases.
    return 0;
  }

  private computeWeightedAvg(input: {
    currentQty: number;
    currentAvgMinor: number;
    deltaQty: number;
    deltaUnitMinor: number;
  }): number {
    if (input.deltaQty <= 0) return input.currentAvgMinor;
    const totalValue =
      input.currentQty * input.currentAvgMinor +
      input.deltaQty * input.deltaUnitMinor;
    const totalQty = input.currentQty + input.deltaQty;
    if (totalQty <= 0) return input.deltaUnitMinor;
    return Math.round(totalValue / totalQty);
  }
}
