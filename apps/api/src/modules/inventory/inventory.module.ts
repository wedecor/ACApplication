import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { BookingStockService } from './booking-stock.service';
import { InventoryAlertsController } from './inventory-alerts.controller';
import { InventoryAlertsService } from './inventory-alerts.service';
import { InventoryAnalyticsController } from './inventory-analytics.controller';
import { InventoryAnalyticsService } from './inventory-analytics.service';
import { InventoryItemsController } from './inventory-items.controller';
import { InventoryItemsService } from './inventory-items.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import { InventorySchedulerService } from './inventory-scheduler.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { StockTransfersController } from './stock-transfers.controller';
import { StockTransfersService } from './stock-transfers.service';
import { TechnicianInventoryController } from './technician-inventory.controller';
import { TechnicianInventoryService } from './technician-inventory.service';
import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';
import { WarehousesController } from './warehouses.controller';
import { WarehousesService } from './warehouses.service';

/**
 * Inventory / Spare Parts ERP.
 *
 * The module owns:
 *   - Warehouses + zones
 *   - Catalogue (InventoryItem) + per-warehouse stock snapshot
 *   - Immutable inventory ledger (single source of truth for movements)
 *   - Vendors + procurement (PO, GRN)
 *   - Stock transfers between warehouses
 *   - Technician van inventory + reconciliation
 *   - Alerts + analytics
 *   - Scheduled jobs for low stock / overdue transfers / overdue POs
 *
 * `InventoryLedgerService` and `InventoryItemsService` are exported so that
 * the bookings + dispatch modules can reserve/release/consume stock without
 * having to depend on the entire feature surface.
 */
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    InventoryLedgerService,
    InventoryItemsService,
    WarehousesService,
    VendorsService,
    PurchaseOrdersService,
    StockTransfersService,
    TechnicianInventoryService,
    InventoryAlertsService,
    InventoryAnalyticsService,
    InventorySchedulerService,
    BookingStockService,
  ],
  controllers: [
    InventoryItemsController,
    WarehousesController,
    VendorsController,
    PurchaseOrdersController,
    StockTransfersController,
    TechnicianInventoryController,
    InventoryAlertsController,
    InventoryAnalyticsController,
  ],
  exports: [
    InventoryLedgerService,
    InventoryItemsService,
    InventoryAlertsService,
    InventoryAnalyticsService,
    TechnicianInventoryService,
    StockTransfersService,
    PurchaseOrdersService,
    VendorsService,
    WarehousesService,
    BookingStockService,
  ],
})
export class InventoryModule {}
