/**
 * Inventory items (catalogue) — CRUD + search + valuation.
 *
 * Stock-level operations (adjust, reserve, release) live here as well so the
 * domain has a single, narrow public API surface for catalogue + balance
 * questions. Movements that change physical or reserved quantities all flow
 * through the `InventoryLedgerService` to preserve audit invariants.
 */

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  DomainEventName,
  InventoryItemType,
  StockMovementKind,
} from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { DomainEventBus } from '../../common/events/domain-event-bus.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  deriveTenantBarcode,
  suggestSku,
} from '../../common/inventory/codes';
import {
  CreateInventoryItemDto,
  ListItemsDto,
  StockAdjustmentDto,
  UpdateInventoryItemDto,
} from './dto/inventory-item.dto';
import { InventoryLedgerService } from './inventory-ledger.service';

@Injectable()
export class InventoryItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: InventoryLedgerService,
    private readonly events: DomainEventBus,
  ) {}

  // -------------------------------------------------------------------- create
  async create(actor: AuthPrincipal, dto: CreateInventoryItemDto) {
    const sku =
      dto.sku?.trim() ||
      (await suggestSku(this.prisma, actor.tenantId, {
        name: dto.name,
        brand: dto.brand,
        type: dto.type,
      }));

    const duplicate = await this.prisma.client.inventoryItem.findUnique({
      where: { tenantId_sku: { tenantId: actor.tenantId, sku } },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('SKU already exists');

    if (dto.preferredVendorId) {
      const vendor = await this.prisma.client.vendor.findFirst({
        where: { id: dto.preferredVendorId, tenantId: actor.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!vendor) throw new NotFoundException('Preferred vendor not found');
    }

    const item = await this.prisma.client.inventoryItem.create({
      data: {
        tenantId: actor.tenantId,
        sku,
        barcode: dto.barcode ?? null,
        name: dto.name,
        description: dto.description ?? null,
        type: dto.type ?? InventoryItemType.SPARE_PART,
        category: dto.category ?? null,
        brand: dto.brand ?? null,
        compatibleApplianceCategories: dto.compatibleApplianceCategories ?? [],
        compatibleBrands: dto.compatibleBrands ?? [],
        unit: dto.unit ?? undefined,
        costPriceMinor: dto.costPriceMinor ?? 0,
        sellingPriceMinor: dto.sellingPriceMinor ?? 0,
        gstRateBps: dto.gstRateBps ?? 1800,
        hsnCode: dto.hsnCode ?? null,
        serialTracking: dto.serialTracking ?? false,
        batchTracking: dto.batchTracking ?? false,
        shelfLifeDays: dto.shelfLifeDays ?? null,
        warrantyDays: dto.warrantyDays ?? null,
        preferredVendorId: dto.preferredVendorId ?? null,
        defaultReorderLevel: dto.defaultReorderLevel ?? 0,
        defaultReorderQty: dto.defaultReorderQty ?? 0,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
    });

    // If no barcode was supplied, mint a deterministic one from the item id.
    if (!item.barcode) {
      const minted = deriveTenantBarcode(actor.tenantId, item.id);
      await this.prisma.client.inventoryItem.update({
        where: { id: item.id },
        data: { barcode: minted },
      });
      item.barcode = minted;
    }

    this.events.publish(DomainEventName.InventoryItemCreated, {
      itemId: item.id,
      sku: item.sku,
      name: item.name,
    });

    return item;
  }

  // ---------------------------------------------------------------------- list
  async list(actor: AuthPrincipal, dto: ListItemsDto) {
    const where: Prisma.InventoryItemWhereInput = {
      tenantId: actor.tenantId,
      deletedAt: null,
    };
    if (dto.type) where.type = dto.type;
    if (dto.category) where.category = dto.category;
    if (dto.brand) where.brand = dto.brand;
    if (dto.vendorId) where.preferredVendorId = dto.vendorId;
    if (typeof dto.isActive === 'boolean') where.isActive = dto.isActive;
    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search, mode: 'insensitive' } },
        { sku: { contains: dto.search, mode: 'insensitive' } },
        { barcode: { contains: dto.search } },
        { brand: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.client.inventoryItem.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        skip: dto.skip,
        take: dto.pageSize,
        include: {
          stocks: dto.warehouseId
            ? {
                where: { warehouseId: dto.warehouseId },
              }
            : true,
        },
      }),
      this.prisma.client.inventoryItem.count({ where }),
    ]);

    let enriched = items.map((i) => this.summarise(i));
    if (dto.lowStockOnly) {
      enriched = enriched.filter((row) => row.lowStock);
    }
    return { items: enriched, total, page: dto.page, pageSize: dto.pageSize };
  }

  async get(actor: AuthPrincipal, id: string) {
    const item = await this.prisma.client.inventoryItem.findFirst({
      where: { id, tenantId: actor.tenantId, deletedAt: null },
      include: {
        stocks: { include: { warehouse: { select: { id: true, name: true, code: true } } } },
        preferredVendor: { select: { id: true, companyName: true, code: true } },
      },
    });
    if (!item) throw new NotFoundException('Inventory item not found');
    return { ...item, ...this.summarise(item) };
  }

  async findByCode(
    actor: AuthPrincipal,
    code: string,
  ): Promise<{ id: string; sku: string; name: string; barcode: string | null } | null> {
    const item = await this.prisma.client.inventoryItem.findFirst({
      where: {
        tenantId: actor.tenantId,
        deletedAt: null,
        OR: [
          { sku: code },
          { barcode: code },
          { qrCode: code },
        ],
      },
      select: { id: true, sku: true, name: true, barcode: true },
    });
    return item;
  }

  async update(actor: AuthPrincipal, id: string, dto: UpdateInventoryItemDto) {
    await this.assertItem(actor.tenantId, id);
    return this.prisma.client.inventoryItem.update({
      where: { id },
      data: { ...dto, updatedBy: actor.userId },
    });
  }

  async softDelete(actor: AuthPrincipal, id: string) {
    const item = await this.assertItem(actor.tenantId, id);
    const totals = await this.prisma.client.warehouseStock.aggregate({
      where: { itemId: item.id },
      _sum: { quantity: true, reservedQuantity: true },
    });
    if ((totals._sum.quantity ?? 0) > 0 || (totals._sum.reservedQuantity ?? 0) > 0) {
      throw new ConflictException('Cannot deactivate an item with on-hand stock');
    }
    await this.prisma.client.inventoryItem.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, updatedBy: actor.userId },
    });
    return { ok: true };
  }

  // ----------------------------------------------------------------- stock ops
  async adjustStock(actor: AuthPrincipal, dto: StockAdjustmentDto) {
    if (dto.quantity === 0) throw new BadRequestException('Quantity cannot be zero');
    await this.assertWarehouse(actor.tenantId, dto.warehouseId);
    await this.assertItem(actor.tenantId, dto.itemId);

    const kind =
      dto.quantity > 0
        ? StockMovementKind.IN_ADJUSTMENT
        : StockMovementKind.OUT_ADJUSTMENT;

    return this.ledger.post({
      tenantId: actor.tenantId,
      itemId: dto.itemId,
      warehouseId: dto.warehouseId,
      kind,
      quantity: Math.abs(dto.quantity),
      unitCostMinor: dto.unitCostMinor,
      adjustmentReason: dto.reason,
      description: `Manual adjustment: ${dto.reason}`,
      externalRef: dto.externalRef,
      createdBy: actor.userId,
      // Adjustments are how warehouse staff correct counts; we allow negative.
      allowNegative: true,
    });
  }

  async reserve(
    tenantId: string,
    warehouseId: string,
    itemId: string,
    quantity: number,
    externalRef?: string,
    bookingId?: string | null,
  ) {
    return this.ledger.post({
      tenantId,
      warehouseId,
      itemId,
      kind: StockMovementKind.RESERVE,
      quantity,
      bookingId: bookingId ?? null,
      description: bookingId ? `Reserved for booking ${bookingId}` : 'Stock reserved',
      externalRef,
    });
  }

  async releaseReservation(
    tenantId: string,
    warehouseId: string,
    itemId: string,
    quantity: number,
    externalRef?: string,
    bookingId?: string | null,
  ) {
    return this.ledger.post({
      tenantId,
      warehouseId,
      itemId,
      kind: StockMovementKind.RELEASE_RESERVE,
      quantity,
      bookingId: bookingId ?? null,
      description: bookingId
        ? `Released reservation for booking ${bookingId}`
        : 'Reservation released',
      externalRef,
    });
  }

  // ------------------------------------------------------------ stock readouts
  async warehouseStock(actor: AuthPrincipal, warehouseId: string, opts: { search?: string } = {}) {
    await this.assertWarehouse(actor.tenantId, warehouseId);
    const where: Prisma.WarehouseStockWhereInput = { warehouseId };
    if (opts.search) {
      where.item = {
        is: {
          OR: [
            { name: { contains: opts.search, mode: 'insensitive' } },
            { sku: { contains: opts.search, mode: 'insensitive' } },
            { barcode: { contains: opts.search } },
          ],
        },
      };
    }
    return this.prisma.client.warehouseStock.findMany({
      where,
      include: {
        item: {
          select: {
            id: true,
            sku: true,
            name: true,
            unit: true,
            type: true,
            barcode: true,
            defaultReorderLevel: true,
            defaultReorderQty: true,
            costPriceMinor: true,
            sellingPriceMinor: true,
          },
        },
        zone: { select: { id: true, code: true } },
      },
      orderBy: { item: { name: 'asc' } },
    });
  }

  async itemLedger(
    actor: AuthPrincipal,
    itemId: string,
    opts: { warehouseId?: string; limit?: number; cursor?: string } = {},
  ) {
    await this.assertItem(actor.tenantId, itemId);
    return this.prisma.client.inventoryLedger.findMany({
      where: {
        tenantId: actor.tenantId,
        itemId,
        warehouseId: opts.warehouseId,
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: opts.limit ?? 50,
      cursor: opts.cursor ? { id: opts.cursor } : undefined,
      skip: opts.cursor ? 1 : 0,
    });
  }

  // ---------------------------------------------------------------- internals
  private summarise(item: Prisma.InventoryItemGetPayload<{ include: { stocks: true } }>) {
    const totalQuantity = item.stocks.reduce((a, s) => a + s.quantity, 0);
    const totalReserved = item.stocks.reduce((a, s) => a + s.reservedQuantity, 0);
    const available = totalQuantity - totalReserved;
    const reorderLevel = item.stocks.reduce((max, s) => {
      const level = s.reorderLevel ?? item.defaultReorderLevel ?? 0;
      return Math.max(max, level);
    }, item.defaultReorderLevel ?? 0);
    const valuationMinor = item.stocks.reduce(
      (acc, s) => acc + s.quantity * (s.avgCostMinor || item.costPriceMinor),
      0,
    );
    return {
      totalQuantity,
      totalReserved,
      available,
      lowStock: available <= reorderLevel,
      valuationMinor,
    };
  }

  private async assertItem(tenantId: string, id: string) {
    const item = await this.prisma.client.inventoryItem.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true, sku: true, defaultReorderLevel: true },
    });
    if (!item) throw new NotFoundException('Inventory item not found');
    return item;
  }

  private async assertWarehouse(tenantId: string, id: string) {
    const wh = await this.prisma.client.warehouse.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!wh) throw new NotFoundException('Warehouse not found');
    return wh;
  }
}
