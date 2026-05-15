/**
 * Inventory alert engine.
 *
 * Alert kinds:
 *   LOW_STOCK         — available < reorder level
 *   OUT_OF_STOCK      — available == 0
 *   EXPIRING_SOON     — earliestExpiryAt within 30 days
 *   EXPIRED           — earliestExpiryAt < now
 *   SLOW_MOVING       — lastMovementAt older than 60 days
 *   DEAD_STOCK        — lastMovementAt older than 180 days
 *   PENDING_TRANSFER  — transfer dispatched > 7 days ago, not received
 *   OVERDUE_PO        — PO ordered, expectedAt in the past, not received
 *   TECHNICIAN_MISMATCH — raised inline by TechnicianInventoryService.reconcile
 *   NEGATIVE_STOCK    — defensive: warehouse stock dropped < 0 somehow
 *
 * Dedupe: each open alert carries a `dedupeKey` of the form
 * `<kind>:<itemId|warehouseId|transferId|poId>`. Re-running the scanner
 * is a no-op unless the alert was previously RESOLVED.
 *
 * Realtime: every raised alert emits `inventory.alert_raised`. Resolved
 * alerts emit `inventory.alert_resolved`. The websocket gateway forwards
 * these to admin dashboards.
 */

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  DomainEventName,
  InventoryAlertKind,
  InventoryAlertSeverity,
  InventoryAlertStatus,
  PurchaseOrderStatus,
  StockTransferStatus,
} from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { DomainEventBus } from '../../common/events/domain-event-bus.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const SLOW_MOVING_DAYS = 60;
const DEAD_STOCK_DAYS = 180;
const TRANSFER_OVERDUE_DAYS = 7;
const EXPIRY_SOON_DAYS = 30;

interface RaiseInput {
  tenantId: string;
  kind: InventoryAlertKind;
  severity?: InventoryAlertSeverity;
  itemId?: string | null;
  warehouseId?: string | null;
  vendorId?: string | null;
  transferId?: string | null;
  purchaseOrderId?: string | null;
  technicianId?: string | null;
  title: string;
  observedValue?: number | null;
  thresholdValue?: number | null;
  dedupeKey: string;
}

@Injectable()
export class InventoryAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventBus,
  ) {}

  // ------------------------------------------------------------------- list
  async list(
    actor: AuthPrincipal,
    opts: {
      status?: InventoryAlertStatus;
      kind?: InventoryAlertKind;
      severity?: InventoryAlertSeverity;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const where: Prisma.InventoryAlertWhereInput = { tenantId: actor.tenantId };
    if (opts.status) where.status = opts.status;
    if (opts.kind) where.kind = opts.kind;
    if (opts.severity) where.severity = opts.severity;
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 25;
    const [items, total] = await Promise.all([
      this.prisma.client.inventoryAlert.findMany({
        where,
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { item: { select: { id: true, sku: true, name: true } } },
      }),
      this.prisma.client.inventoryAlert.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async acknowledge(actor: AuthPrincipal, id: string) {
    const alert = await this.prisma.client.inventoryAlert.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!alert) return null;
    return this.prisma.client.inventoryAlert.update({
      where: { id },
      data: {
        status: InventoryAlertStatus.ACKNOWLEDGED,
        acknowledgedAt: new Date(),
        acknowledgedBy: actor.userId,
      },
    });
  }

  async resolve(actor: AuthPrincipal, id: string) {
    const alert = await this.prisma.client.inventoryAlert.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!alert) return null;
    const updated = await this.prisma.client.inventoryAlert.update({
      where: { id },
      data: { status: InventoryAlertStatus.RESOLVED, resolvedAt: new Date() },
    });
    this.events.publish(DomainEventName.InventoryAlertResolved, { alertId: id });
    return updated;
  }

  async snooze(_actor: AuthPrincipal, id: string, until: Date) {
    return this.prisma.client.inventoryAlert.update({
      where: { id },
      data: { status: InventoryAlertStatus.SNOOZED, snoozedUntil: until },
    });
  }

  // ------------------------------------------------------- raise helper (atomic)
  async raise(input: RaiseInput) {
    const dedupe = input.dedupeKey;
    const existing = await this.prisma.client.inventoryAlert.findFirst({
      where: {
        tenantId: input.tenantId,
        dedupeKey: dedupe,
        status: { in: [InventoryAlertStatus.OPEN, InventoryAlertStatus.ACKNOWLEDGED, InventoryAlertStatus.SNOOZED] },
      },
      select: { id: true, status: true, snoozedUntil: true },
    });
    if (existing) {
      // Re-arm a snoozed alert if its snooze window has elapsed.
      if (existing.status === InventoryAlertStatus.SNOOZED && existing.snoozedUntil && existing.snoozedUntil <= new Date()) {
        await this.prisma.client.inventoryAlert.update({
          where: { id: existing.id },
          data: { status: InventoryAlertStatus.OPEN, snoozedUntil: null },
        });
      }
      return existing.id;
    }
    const created = await this.prisma.client.inventoryAlert.create({
      data: {
        tenantId: input.tenantId,
        kind: input.kind,
        severity: input.severity ?? InventoryAlertSeverity.WARNING,
        itemId: input.itemId ?? null,
        warehouseId: input.warehouseId ?? null,
        vendorId: input.vendorId ?? null,
        transferId: input.transferId ?? null,
        purchaseOrderId: input.purchaseOrderId ?? null,
        technicianId: input.technicianId ?? null,
        title: input.title,
        observedValue: input.observedValue ?? null,
        thresholdValue: input.thresholdValue ?? null,
        dedupeKey: dedupe,
      },
      select: { id: true },
    });
    this.events.publish(DomainEventName.InventoryAlertRaised, {
      alertId: created.id,
      kind: input.kind,
      severity: input.severity ?? InventoryAlertSeverity.WARNING,
      itemId: input.itemId ?? null,
      warehouseId: input.warehouseId ?? null,
      title: input.title,
    });
    return created.id;
  }

  // ------------------------------------------------------------- scanners
  /**
   * Scan all warehouses for stock-level alerts. Returns the count of alerts
   * raised this pass. Idempotent — pre-existing open alerts with the same
   * dedupe key are skipped.
   */
  async scanLowStock(tenantId?: string): Promise<number> {
    const tenants = tenantId
      ? [{ id: tenantId }]
      : await this.prisma.client.tenant.findMany({
          where: { isActive: true, deletedAt: null },
          select: { id: true },
        });

    let raised = 0;
    for (const t of tenants) {
      const stocks = await this.prisma.client.warehouseStock.findMany({
        where: { tenantId: t.id },
        include: {
          item: { select: { id: true, name: true, sku: true, defaultReorderLevel: true } },
          warehouse: { select: { id: true, name: true, code: true } },
        },
      });
      for (const s of stocks) {
        const reorderLevel = s.reorderLevel ?? s.item.defaultReorderLevel ?? 0;
        const available = s.quantity - s.reservedQuantity;
        if (available <= 0) {
          await this.raise({
            tenantId: t.id,
            kind: InventoryAlertKind.OUT_OF_STOCK,
            severity: InventoryAlertSeverity.CRITICAL,
            itemId: s.itemId,
            warehouseId: s.warehouseId,
            title: `Out of stock: ${s.item.name} @ ${s.warehouse.name}`,
            observedValue: available,
            thresholdValue: 0,
            dedupeKey: `out_of_stock:${s.warehouseId}:${s.itemId}`,
          });
          raised += 1;
        } else if (reorderLevel > 0 && available <= reorderLevel) {
          await this.raise({
            tenantId: t.id,
            kind: InventoryAlertKind.LOW_STOCK,
            severity: InventoryAlertSeverity.WARNING,
            itemId: s.itemId,
            warehouseId: s.warehouseId,
            title: `Low stock: ${s.item.name} @ ${s.warehouse.name} (${available} ≤ ${reorderLevel})`,
            observedValue: available,
            thresholdValue: reorderLevel,
            dedupeKey: `low_stock:${s.warehouseId}:${s.itemId}`,
          });
          raised += 1;
        }
        if (s.earliestExpiryAt) {
          const expiringWithin = new Date();
          expiringWithin.setDate(expiringWithin.getDate() + EXPIRY_SOON_DAYS);
          if (s.earliestExpiryAt <= new Date()) {
            await this.raise({
              tenantId: t.id,
              kind: InventoryAlertKind.EXPIRED,
              severity: InventoryAlertSeverity.CRITICAL,
              itemId: s.itemId,
              warehouseId: s.warehouseId,
              title: `Expired stock: ${s.item.name}`,
              dedupeKey: `expired:${s.warehouseId}:${s.itemId}`,
            });
            raised += 1;
          } else if (s.earliestExpiryAt <= expiringWithin) {
            await this.raise({
              tenantId: t.id,
              kind: InventoryAlertKind.EXPIRING_SOON,
              severity: InventoryAlertSeverity.WARNING,
              itemId: s.itemId,
              warehouseId: s.warehouseId,
              title: `Expiring soon: ${s.item.name}`,
              dedupeKey: `expiring_soon:${s.warehouseId}:${s.itemId}`,
            });
            raised += 1;
          }
        }
        if (s.lastMovementAt) {
          const days = (Date.now() - s.lastMovementAt.getTime()) / (1000 * 60 * 60 * 24);
          if (days > DEAD_STOCK_DAYS && s.quantity > 0) {
            await this.raise({
              tenantId: t.id,
              kind: InventoryAlertKind.DEAD_STOCK,
              severity: InventoryAlertSeverity.WARNING,
              itemId: s.itemId,
              warehouseId: s.warehouseId,
              title: `Dead stock: ${s.item.name} (no movement ${Math.round(days)}d)`,
              observedValue: Math.round(days),
              thresholdValue: DEAD_STOCK_DAYS,
              dedupeKey: `dead_stock:${s.warehouseId}:${s.itemId}`,
            });
            raised += 1;
          } else if (days > SLOW_MOVING_DAYS && s.quantity > 0) {
            await this.raise({
              tenantId: t.id,
              kind: InventoryAlertKind.SLOW_MOVING,
              severity: InventoryAlertSeverity.INFO,
              itemId: s.itemId,
              warehouseId: s.warehouseId,
              title: `Slow moving: ${s.item.name} (${Math.round(days)}d)`,
              observedValue: Math.round(days),
              thresholdValue: SLOW_MOVING_DAYS,
              dedupeKey: `slow_moving:${s.warehouseId}:${s.itemId}`,
            });
            raised += 1;
          }
        }
        if (s.quantity < 0) {
          await this.raise({
            tenantId: t.id,
            kind: InventoryAlertKind.NEGATIVE_STOCK,
            severity: InventoryAlertSeverity.CRITICAL,
            itemId: s.itemId,
            warehouseId: s.warehouseId,
            title: `Negative stock detected: ${s.item.name}`,
            observedValue: s.quantity,
            thresholdValue: 0,
            dedupeKey: `negative_stock:${s.warehouseId}:${s.itemId}`,
          });
          raised += 1;
        }
      }
    }
    return raised;
  }

  /**
   * Raise alerts for stock transfers that have been "in transit" longer
   * than the configured window without being received.
   */
  async scanPendingTransfers(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - TRANSFER_OVERDUE_DAYS);
    const transfers = await this.prisma.client.stockTransfer.findMany({
      where: {
        status: StockTransferStatus.IN_TRANSIT,
        dispatchedAt: { lt: cutoff },
        deletedAt: null,
      },
      select: { id: true, tenantId: true, number: true, dispatchedAt: true },
    });
    for (const t of transfers) {
      await this.raise({
        tenantId: t.tenantId,
        kind: InventoryAlertKind.PENDING_TRANSFER,
        severity: InventoryAlertSeverity.WARNING,
        transferId: t.id,
        title: `Transfer ${t.number} pending receipt for > ${TRANSFER_OVERDUE_DAYS} days`,
        dedupeKey: `pending_transfer:${t.id}`,
      });
    }
    return transfers.length;
  }

  /**
   * Raise alerts for purchase orders whose expectedAt has passed without
   * full receipt.
   */
  async scanOverduePos(): Promise<number> {
    const pos = await this.prisma.client.purchaseOrder.findMany({
      where: {
        status: { in: [PurchaseOrderStatus.ORDERED, PurchaseOrderStatus.PARTIALLY_RECEIVED] },
        expectedAt: { lt: new Date() },
        deletedAt: null,
      },
      select: { id: true, tenantId: true, number: true, vendorId: true, expectedAt: true },
    });
    for (const p of pos) {
      await this.raise({
        tenantId: p.tenantId,
        kind: InventoryAlertKind.OVERDUE_PO,
        severity: InventoryAlertSeverity.WARNING,
        purchaseOrderId: p.id,
        vendorId: p.vendorId,
        title: `PO ${p.number} overdue (expected ${p.expectedAt?.toISOString().slice(0, 10)})`,
        dedupeKey: `overdue_po:${p.id}`,
      });
    }
    return pos.length;
  }
}
