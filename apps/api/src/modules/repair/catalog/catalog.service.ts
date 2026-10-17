import type { AuthPrincipal } from '@ac/auth';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { compact, isUniqueViolation, toNullableString } from '../domain/util';
import { CreateCatalogItemDto, ListCatalogDto, UpdateCatalogItemDto } from './dto/catalog.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  list(actor: AuthPrincipal, query: ListCatalogDto) {
    const q = query.q?.trim();
    return this.prisma.client.serviceCatalogItem.findMany({
      where: {
        tenantId: actor.tenantId,
        deletedAt: null,
        ...(query.category ? { category: query.category } : {}),
        ...(query.active !== undefined ? { isActive: query.active } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { code: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async get(actor: AuthPrincipal, id: string) {
    const row = await this.prisma.client.serviceCatalogItem.findFirst({
      where: { id, tenantId: actor.tenantId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Catalog item not found');
    return row;
  }

  async create(actor: AuthPrincipal, dto: CreateCatalogItemDto) {
    const code = dto.code.toUpperCase();
    const data = {
      category: dto.category,
      name: dto.name.trim(),
      description: toNullableString(dto.description) ?? null,
      basePriceMinor: dto.basePriceMinor ?? 0,
      visitChargeMinor: dto.visitChargeMinor ?? 0,
      estimatedMinutes: dto.estimatedMinutes ?? 60,
      repairWarrantyDays: dto.repairWarrantyDays ?? 30,
      gstRateBps: dto.gstRateBps ?? 1800,
      sacCode: toNullableString(dto.sacCode) ?? null,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
      updatedBy: actor.userId,
    };

    // A soft-deleted row still owns the (tenant, code) unique key — revive it.
    const existing = await this.prisma.client.serviceCatalogItem.findUnique({
      where: { tenantId_code: { tenantId: actor.tenantId, code } },
      select: { id: true, deletedAt: true },
    });
    if (existing && !existing.deletedAt) {
      throw new ConflictException(`Catalog code ${code} already exists`);
    }
    if (existing) {
      return this.prisma.client.serviceCatalogItem.update({
        where: { id: existing.id },
        data: { ...data, deletedAt: null, deletedBy: null },
      });
    }
    try {
      return await this.prisma.client.serviceCatalogItem.create({
        data: { ...data, tenantId: actor.tenantId, code, createdBy: actor.userId },
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException(`Catalog code ${code} already exists`);
      throw err;
    }
  }

  async update(actor: AuthPrincipal, id: string, dto: UpdateCatalogItemDto) {
    await this.get(actor, id);
    const data = compact({
      code: dto.code?.toUpperCase(),
      category: dto.category,
      name: dto.name?.trim(),
      description: toNullableString(dto.description),
      basePriceMinor: dto.basePriceMinor,
      visitChargeMinor: dto.visitChargeMinor,
      estimatedMinutes: dto.estimatedMinutes,
      repairWarrantyDays: dto.repairWarrantyDays,
      gstRateBps: dto.gstRateBps,
      sacCode: toNullableString(dto.sacCode),
      isActive: dto.isActive,
      sortOrder: dto.sortOrder,
    });
    try {
      return await this.prisma.client.serviceCatalogItem.update({
        where: { id },
        data: { ...data, updatedBy: actor.userId },
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException('Catalog code already exists');
      throw err;
    }
  }

  async remove(actor: AuthPrincipal, id: string) {
    await this.get(actor, id);
    await this.prisma.client.serviceCatalogItem.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: actor.userId, isActive: false },
    });
    return { id, deleted: true };
  }
}
