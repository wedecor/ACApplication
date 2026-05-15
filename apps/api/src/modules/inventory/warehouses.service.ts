/**
 * Warehouse management — multi-warehouse foundation for the inventory ERP.
 *
 * Warehouses are tenant-scoped and city-aware so dispatch / routing can
 * later use the warehouse's city to score parts availability for nearby
 * bookings. Soft-delete is honoured everywhere; we never hard-delete a
 * warehouse with historical movements.
 */

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type { AuthPrincipal } from '@ac/auth';

import { PrismaService } from '../../common/prisma/prisma.service';
import type {
  CreateWarehouseDto,
  CreateZoneDto,
  ListWarehousesDto,
  UpdateWarehouseDto,
} from './dto/warehouse.dto';

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------- warehouses
  async create(actor: AuthPrincipal, dto: CreateWarehouseDto) {
    const exists = await this.prisma.client.warehouse.findFirst({
      where: { tenantId: actor.tenantId, code: dto.code, deletedAt: null },
      select: { id: true },
    });
    if (exists) throw new ConflictException('Warehouse code already exists');

    return this.prisma.client.warehouse.create({
      data: {
        tenantId: actor.tenantId,
        code: dto.code,
        name: dto.name,
        kind: dto.kind ?? undefined,
        cityId: dto.cityId ?? null,
        addressLine1: dto.addressLine1 ?? null,
        addressLine2: dto.addressLine2 ?? null,
        pincode: dto.pincode ?? null,
        state: dto.state ?? null,
        gstin: dto.gstin ?? null,
        managerUserId: dto.managerUserId ?? null,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
    });
  }

  async list(actor: AuthPrincipal, dto: ListWarehousesDto) {
    const where: Prisma.WarehouseWhereInput = {
      tenantId: actor.tenantId,
      deletedAt: null,
    };
    if (dto.kind) where.kind = dto.kind;
    if (dto.cityId) where.cityId = dto.cityId;
    if (typeof dto.isActive === 'boolean') where.isActive = dto.isActive;
    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search, mode: 'insensitive' } },
        { code: { contains: dto.search, mode: 'insensitive' } },
        { pincode: { contains: dto.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.client.warehouse.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        skip: dto.skip,
        take: dto.pageSize,
        include: {
          _count: { select: { stocks: true, zones: true } },
        },
      }),
      this.prisma.client.warehouse.count({ where }),
    ]);
    return { items, total, page: dto.page, pageSize: dto.pageSize };
  }

  async get(actor: AuthPrincipal, id: string) {
    const wh = await this.prisma.client.warehouse.findFirst({
      where: { id, tenantId: actor.tenantId, deletedAt: null },
      include: {
        zones: { where: { deletedAt: null }, orderBy: { code: 'asc' } },
        _count: { select: { stocks: true } },
      },
    });
    if (!wh) throw new NotFoundException('Warehouse not found');
    return wh;
  }

  async update(actor: AuthPrincipal, id: string, dto: UpdateWarehouseDto) {
    const wh = await this.prisma.client.warehouse.findFirst({
      where: { id, tenantId: actor.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!wh) throw new NotFoundException('Warehouse not found');
    return this.prisma.client.warehouse.update({
      where: { id },
      data: { ...dto, updatedBy: actor.userId },
    });
  }

  async softDelete(actor: AuthPrincipal, id: string) {
    const wh = await this.prisma.client.warehouse.findFirst({
      where: { id, tenantId: actor.tenantId, deletedAt: null },
      select: { id: true, _count: { select: { stocks: true } } },
    });
    if (!wh) throw new NotFoundException('Warehouse not found');
    const onHand = await this.prisma.client.warehouseStock.aggregate({
      where: { warehouseId: id },
      _sum: { quantity: true, reservedQuantity: true },
    });
    if ((onHand._sum.quantity ?? 0) > 0 || (onHand._sum.reservedQuantity ?? 0) > 0) {
      throw new ConflictException(
        'Cannot delete a warehouse with remaining stock — transfer stock out first.',
      );
    }
    await this.prisma.client.warehouse.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: actor.userId, isActive: false },
    });
    return { ok: true };
  }

  // -------------------------------------------------------------------- zones
  async addZone(actor: AuthPrincipal, warehouseId: string, dto: CreateZoneDto) {
    const wh = await this.assertWarehouse(actor.tenantId, warehouseId);
    const exists = await this.prisma.client.warehouseZone.findFirst({
      where: { warehouseId, code: dto.code, deletedAt: null },
      select: { id: true },
    });
    if (exists) throw new ConflictException('Zone code already exists in this warehouse');
    return this.prisma.client.warehouseZone.create({
      data: {
        tenantId: actor.tenantId,
        warehouseId: wh.id,
        code: dto.code,
        name: dto.name,
        binLabel: dto.binLabel ?? null,
      },
    });
  }

  async removeZone(actor: AuthPrincipal, warehouseId: string, zoneId: string) {
    await this.assertWarehouse(actor.tenantId, warehouseId);
    const z = await this.prisma.client.warehouseZone.findFirst({
      where: { id: zoneId, warehouseId, deletedAt: null },
      select: { id: true },
    });
    if (!z) throw new NotFoundException('Zone not found');
    // If any stock is parked in this zone, refuse to delete.
    const inUse = await this.prisma.client.warehouseStock.count({
      where: { zoneId, quantity: { gt: 0 } },
    });
    if (inUse > 0) throw new ConflictException('Move stock out of the zone before deleting it');
    await this.prisma.client.warehouseZone.update({
      where: { id: zoneId },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { ok: true };
  }

  // -------------------------------------------------------- per-warehouse stats
  async stats(actor: AuthPrincipal, id: string) {
    const wh = await this.assertWarehouse(actor.tenantId, id);
    const stocks = await this.prisma.client.warehouseStock.findMany({
      where: { warehouseId: wh.id },
      include: {
        item: {
          select: {
            id: true,
            sku: true,
            name: true,
            costPriceMinor: true,
            sellingPriceMinor: true,
            defaultReorderLevel: true,
          },
        },
      },
    });
    const totalValuationMinor = stocks.reduce(
      (acc, s) => acc + s.quantity * (s.avgCostMinor || s.item.costPriceMinor),
      0,
    );
    const lowStockCount = stocks.filter(
      (s) =>
        (s.quantity - s.reservedQuantity) <=
        (s.reorderLevel ?? s.item.defaultReorderLevel ?? 0),
    ).length;
    return {
      warehouseId: wh.id,
      skuCount: stocks.length,
      totalQuantity: stocks.reduce((a, s) => a + s.quantity, 0),
      totalReserved: stocks.reduce((a, s) => a + s.reservedQuantity, 0),
      totalValuationMinor,
      lowStockCount,
    };
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
