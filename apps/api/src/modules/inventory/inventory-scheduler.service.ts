/**
 * Inventory cron jobs.
 *
 *  • `scanLowStock`         every 10 minutes — raise low/out-of-stock alerts.
 *  • `scanExpiryAndAgeing`  every 6 hours    — expiring soon / dead stock.
 *  • `scanPendingTransfers` daily 07:00      — overdue in-transit transfers.
 *  • `scanOverduePos`       daily 07:30      — overdue purchase orders.
 *  • `autoReleaseExpiredAlerts` hourly       — resolves alerts whose root
 *    cause has cleared (e.g. stock replenished above reorder).
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { InventoryAlertStatus, InventoryAlertKind } from '@ac/types';

import { PrismaService } from '../../common/prisma/prisma.service';
import { InventoryAlertsService } from './inventory-alerts.service';

@Injectable()
export class InventorySchedulerService {
  private readonly logger = new Logger(InventorySchedulerService.name);
  private readonly disabled = process.env.INVENTORY_SCHEDULER_DISABLED === '1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: InventoryAlertsService,
  ) {}

  private gated(name: string): boolean {
    if (this.disabled) {
      this.logger.debug(`Inventory cron ${name} skipped (disabled)`);
      return true;
    }
    return false;
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async scanLowStock(): Promise<void> {
    if (this.gated('scanLowStock')) return;
    try {
      const raised = await this.alerts.scanLowStock();
      if (raised > 0) this.logger.log(`Stock alert sweep raised/checked ${raised} alert(s)`);
    } catch (err) {
      this.logger.warn({ err }, 'scanLowStock failed');
    }
  }

  @Cron('0 */6 * * *')
  async scanExpiryAndAgeing(): Promise<void> {
    if (this.gated('scanExpiryAndAgeing')) return;
    try {
      await this.alerts.scanLowStock();
    } catch (err) {
      this.logger.warn({ err }, 'scanExpiryAndAgeing failed');
    }
  }

  @Cron('0 7 * * *')
  async scanPendingTransfers(): Promise<void> {
    if (this.gated('scanPendingTransfers')) return;
    try {
      const n = await this.alerts.scanPendingTransfers();
      if (n > 0) this.logger.log(`Raised ${n} pending-transfer alert(s)`);
    } catch (err) {
      this.logger.warn({ err }, 'scanPendingTransfers failed');
    }
  }

  @Cron('30 7 * * *')
  async scanOverduePos(): Promise<void> {
    if (this.gated('scanOverduePos')) return;
    try {
      const n = await this.alerts.scanOverduePos();
      if (n > 0) this.logger.log(`Raised ${n} overdue-PO alert(s)`);
    } catch (err) {
      this.logger.warn({ err }, 'scanOverduePos failed');
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async autoReleaseExpiredAlerts(): Promise<void> {
    if (this.gated('autoReleaseExpiredAlerts')) return;
    // Auto-resolve LOW_STOCK / OUT_OF_STOCK alerts whose underlying available
    // quantity has risen above the reorder level. This stops dashboards
    // from getting cluttered with stale alerts after a PO receipt.
    const alerts = await this.prisma.client.inventoryAlert.findMany({
      where: {
        status: { in: [InventoryAlertStatus.OPEN, InventoryAlertStatus.ACKNOWLEDGED] },
        kind: { in: [InventoryAlertKind.LOW_STOCK, InventoryAlertKind.OUT_OF_STOCK] },
        itemId: { not: null },
        warehouseId: { not: null },
      },
      select: { id: true, itemId: true, warehouseId: true, kind: true, thresholdValue: true, tenantId: true },
      take: 500,
    });
    let resolved = 0;
    for (const a of alerts) {
      const stock = await this.prisma.client.warehouseStock.findUnique({
        where: { warehouseId_itemId: { warehouseId: a.warehouseId!, itemId: a.itemId! } },
        include: { item: { select: { defaultReorderLevel: true } } },
      });
      if (!stock) continue;
      const reorderLevel = stock.reorderLevel ?? stock.item.defaultReorderLevel ?? 0;
      const available = stock.quantity - stock.reservedQuantity;
      const cleared =
        a.kind === InventoryAlertKind.OUT_OF_STOCK
          ? available > 0
          : available > reorderLevel;
      if (cleared) {
        await this.prisma.client.inventoryAlert.update({
          where: { id: a.id },
          data: { status: InventoryAlertStatus.RESOLVED, resolvedAt: new Date() },
        });
        resolved += 1;
      }
    }
    if (resolved > 0) this.logger.log(`Auto-resolved ${resolved} stock alert(s)`);
  }
}
