/**
 * Inventory analytics — read-only aggregates.
 *
 * Most queries are computed from the ledger + the WarehouseStock snapshot.
 * We deliberately keep these calculations in TypeScript rather than complex
 * raw SQL so they're easy to verify and unit-test. For larger tenants the
 * hot endpoints can be backed by materialised views — the interface won't
 * change.
 */

import { Injectable } from '@nestjs/common';

import { StockMovementKind } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { PrismaService } from '../../common/prisma/prisma.service';
import { InventoryLedgerService } from './inventory-ledger.service';

const DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class InventoryAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly _ledger: InventoryLedgerService,
  ) {
    void this._ledger;
  }

  /** Total stock valuation across all warehouses, broken down by warehouse. */
  async valuation(actor: AuthPrincipal) {
    const stocks = await this.prisma.client.warehouseStock.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        item: { select: { costPriceMinor: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
    });
    const byWh = new Map<
      string,
      { warehouseId: string; code: string; name: string; quantity: number; valuationMinor: number }
    >();
    let grandQuantity = 0;
    let grandValue = 0;
    for (const s of stocks) {
      const cost = s.avgCostMinor || s.item.costPriceMinor;
      const value = s.quantity * cost;
      const cur =
        byWh.get(s.warehouseId) ??
        {
          warehouseId: s.warehouseId,
          code: s.warehouse.code,
          name: s.warehouse.name,
          quantity: 0,
          valuationMinor: 0,
        };
      cur.quantity += s.quantity;
      cur.valuationMinor += value;
      byWh.set(s.warehouseId, cur);
      grandQuantity += s.quantity;
      grandValue += value;
    }
    return {
      totalQuantity: grandQuantity,
      totalValuationMinor: grandValue,
      byWarehouse: Array.from(byWh.values()).sort((a, b) => b.valuationMinor - a.valuationMinor),
    };
  }

  /**
   * Top-N fast-moving items in the last `days` days. "Movement" is the sum
   * of OUT_SALE + OUT_TO_TECHNICIAN + OUT_TO_BOOKING + OUT_TRANSFER for that
   * item.
   */
  async fastMoving(actor: AuthPrincipal, days = 30, limit = 20) {
    const since = new Date(Date.now() - days * DAY);
    const rows = await this.prisma.client.inventoryLedger.findMany({
      where: {
        tenantId: actor.tenantId,
        kind: {
          in: [
            StockMovementKind.OUT_SALE,
            StockMovementKind.OUT_TO_TECHNICIAN,
            StockMovementKind.OUT_TO_BOOKING,
            StockMovementKind.OUT_TRANSFER,
          ],
        },
        occurredAt: { gte: since },
      },
      select: { itemId: true, quantityDelta: true },
    });
    const tally = new Map<string, number>();
    for (const r of rows) tally.set(r.itemId, (tally.get(r.itemId) ?? 0) + Math.abs(r.quantityDelta));
    const top = [...tally.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
    const items = await this.prisma.client.inventoryItem.findMany({
      where: { id: { in: top.map(([id]) => id) }, tenantId: actor.tenantId },
      select: { id: true, sku: true, name: true, unit: true, sellingPriceMinor: true },
    });
    const byId = new Map(items.map((i) => [i.id, i]));
    return top.map(([itemId, units]) => ({
      itemId,
      item: byId.get(itemId) ?? null,
      unitsMoved: units,
    }));
  }

  /** Items with no outflow over the last `days` days but stock on hand > 0. */
  async deadStock(actor: AuthPrincipal, days = 180) {
    const since = new Date(Date.now() - days * DAY);
    const recentlyMovedRows = await this.prisma.client.inventoryLedger.findMany({
      where: {
        tenantId: actor.tenantId,
        kind: {
          in: [
            StockMovementKind.OUT_SALE,
            StockMovementKind.OUT_TO_TECHNICIAN,
            StockMovementKind.OUT_TO_BOOKING,
            StockMovementKind.OUT_TRANSFER,
          ],
        },
        occurredAt: { gte: since },
      },
      select: { itemId: true },
      distinct: ['itemId'],
    });
    const recentlyMoved = new Set(recentlyMovedRows.map((r) => r.itemId));
    const stocks = await this.prisma.client.warehouseStock.findMany({
      where: { tenantId: actor.tenantId, quantity: { gt: 0 } },
      include: {
        item: { select: { id: true, sku: true, name: true, costPriceMinor: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
    });
    return stocks
      .filter((s) => !recentlyMoved.has(s.itemId))
      .map((s) => ({
        item: s.item,
        warehouse: s.warehouse,
        quantity: s.quantity,
        valuationMinor: s.quantity * (s.avgCostMinor || s.item.costPriceMinor),
        lastMovementAt: s.lastMovementAt,
      }))
      .sort((a, b) => b.valuationMinor - a.valuationMinor);
  }

  /**
   * Inventory turnover ratio: cost-of-goods-sold (sum of OUT_* @ unitCost)
   * divided by average inventory over the window. Returned per-item.
   */
  async turnover(actor: AuthPrincipal, days = 90) {
    const since = new Date(Date.now() - days * DAY);
    const outRows = await this.prisma.client.inventoryLedger.findMany({
      where: {
        tenantId: actor.tenantId,
        kind: {
          in: [
            StockMovementKind.OUT_SALE,
            StockMovementKind.OUT_TO_TECHNICIAN,
            StockMovementKind.OUT_TO_BOOKING,
          ],
        },
        occurredAt: { gte: since },
      },
      select: { itemId: true, quantityDelta: true, unitCostMinor: true },
    });
    const cogsByItem = new Map<string, number>();
    for (const r of outRows) {
      const cogs = Math.abs(r.quantityDelta) * (r.unitCostMinor ?? 0);
      cogsByItem.set(r.itemId, (cogsByItem.get(r.itemId) ?? 0) + cogs);
    }
    const stocks = await this.prisma.client.warehouseStock.findMany({
      where: { tenantId: actor.tenantId, itemId: { in: [...cogsByItem.keys()] } },
      include: { item: { select: { id: true, sku: true, name: true, costPriceMinor: true } } },
    });
    const avgInvByItem = new Map<string, { item: typeof stocks[number]['item']; avgValue: number }>();
    for (const s of stocks) {
      const value = s.quantity * (s.avgCostMinor || s.item.costPriceMinor);
      const prev = avgInvByItem.get(s.itemId);
      avgInvByItem.set(s.itemId, {
        item: s.item,
        avgValue: (prev?.avgValue ?? 0) + value,
      });
    }
    return [...cogsByItem.entries()]
      .map(([itemId, cogs]) => {
        const inv = avgInvByItem.get(itemId);
        const ratio = inv && inv.avgValue > 0 ? cogs / inv.avgValue : null;
        return {
          itemId,
          item: inv?.item ?? null,
          cogsMinor: cogs,
          avgInventoryMinor: inv?.avgValue ?? 0,
          turnoverRatio: ratio,
        };
      })
      .sort((a, b) => (b.turnoverRatio ?? 0) - (a.turnoverRatio ?? 0));
  }

  /** Procurement spend by vendor over the window. */
  async procurementSpend(actor: AuthPrincipal, days = 30) {
    const since = new Date(Date.now() - days * DAY);
    const rows = await this.prisma.client.purchaseOrder.findMany({
      where: {
        tenantId: actor.tenantId,
        createdAt: { gte: since },
        status: { in: ['RECEIVED', 'PARTIALLY_RECEIVED', 'ORDERED', 'CLOSED'] },
      },
      select: {
        vendorId: true,
        totalMinor: true,
        vendor: { select: { id: true, companyName: true, code: true } },
      },
    });
    const tally = new Map<string, { vendor: { id: string; companyName: string; code: string }; spendMinor: number; orders: number }>();
    for (const r of rows) {
      const cur = tally.get(r.vendorId) ?? { vendor: r.vendor, spendMinor: 0, orders: 0 };
      cur.spendMinor += r.totalMinor;
      cur.orders += 1;
      tally.set(r.vendorId, cur);
    }
    return [...tally.values()].sort((a, b) => b.spendMinor - a.spendMinor);
  }

  /** Cost recovered from technician shortfalls (warning signal for ops). */
  async technicianWastage(actor: AuthPrincipal, days = 30) {
    const since = new Date(Date.now() - days * DAY);
    const rows = await this.prisma.client.technicianInventory.findMany({
      where: {
        tenantId: actor.tenantId,
        reconciledAt: { gte: since, not: null },
      },
      select: {
        technicianId: true,
        allocatedQty: true,
        usedQty: true,
        returnedQty: true,
        unitCostMinor: true,
      },
    });
    const tally = new Map<string, { technicianId: string; shortfallQty: number; shortfallValueMinor: number }>();
    for (const r of rows) {
      const shortfall = Math.max(0, r.allocatedQty - r.usedQty - r.returnedQty);
      if (shortfall === 0) continue;
      const cur = tally.get(r.technicianId) ?? { technicianId: r.technicianId, shortfallQty: 0, shortfallValueMinor: 0 };
      cur.shortfallQty += shortfall;
      cur.shortfallValueMinor += shortfall * r.unitCostMinor;
      tally.set(r.technicianId, cur);
    }
    return [...tally.values()].sort((a, b) => b.shortfallValueMinor - a.shortfallValueMinor);
  }
}
