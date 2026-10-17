import type { AuthPrincipal } from '@ac/auth';
import type { Prisma } from '@ac/database';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import type { CreateMyApplianceDto, UpdateMyApplianceDto } from './dto/me-profile.dto';
import { categoryLabel, warrantyStatus } from './me.mappers';
import { MeContextService } from './me-context.service';

const APPLIANCE_SELECT = {
  id: true,
  category: true,
  brand: true,
  modelNumber: true,
  serialNumber: true,
  capacity: true,
  installedLocation: true,
  purchaseDate: true,
  installDate: true,
  manufacturerWarrantyUntil: true,
  extendedWarrantyUntil: true,
  photos: true,
  addressId: true,
  notes: true,
  lastServicedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CustomerApplianceSelect;

type ApplianceRow = Prisma.CustomerApplianceGetPayload<{ select: typeof APPLIANCE_SELECT }>;

export function toApplianceView(a: ApplianceRow, now = new Date()) {
  const w = warrantyStatus([a.manufacturerWarrantyUntil, a.extendedWarrantyUntil], now);
  return {
    id: a.id,
    category: a.category,
    categoryLabel: categoryLabel(a.category),
    brand: a.brand,
    modelNumber: a.modelNumber,
    serialNumber: a.serialNumber,
    capacity: a.capacity,
    installedLocation: a.installedLocation,
    purchaseDate: a.purchaseDate?.toISOString() ?? null,
    installDate: a.installDate?.toISOString() ?? null,
    manufacturerWarrantyUntil: a.manufacturerWarrantyUntil?.toISOString() ?? null,
    extendedWarrantyUntil: a.extendedWarrantyUntil?.toISOString() ?? null,
    warranty: { status: w.status, until: w.until?.toISOString() ?? null, daysLeft: w.daysLeft },
    photos: a.photos,
    addressId: a.addressId,
    notes: a.notes,
    lastServicedAt: a.lastServicedAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}

function dateOrNull(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  return v ? new Date(v) : null;
}

/** Customer-registered appliances (CustomerAppliance), always scoped to the caller. */
@Injectable()
export class MeAppliancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: MeContextService,
    private readonly storage: StorageService,
  ) {}

  async list(actor: AuthPrincipal) {
    const customer = await this.ctx.requireCustomer(actor);
    const rows = await this.prisma.client.customerAppliance.findMany({
      where: { tenantId: actor.tenantId, customerId: customer.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: APPLIANCE_SELECT,
    });
    return rows.map((r) => toApplianceView(r));
  }

  async get(actor: AuthPrincipal, id: string) {
    const customer = await this.ctx.requireCustomer(actor);
    return toApplianceView(await this.findOwned(actor.tenantId, customer.id, id));
  }

  async create(actor: AuthPrincipal, dto: CreateMyApplianceDto) {
    const customer = await this.ctx.requireCustomer(actor);
    await this.validateRefs(actor.tenantId, customer.id, dto);
    const row = await this.prisma.client.customerAppliance.create({
      data: {
        tenantId: actor.tenantId,
        customerId: customer.id,
        category: dto.category,
        brand: dto.brand.trim(),
        modelNumber: dto.modelNumber?.trim() || null,
        serialNumber: dto.serialNumber?.trim() || null,
        capacity: dto.capacity?.trim() || null,
        installedLocation: dto.installedLocation?.trim() || null,
        purchaseDate: dateOrNull(dto.purchaseDate) ?? null,
        installDate: dateOrNull(dto.installDate) ?? null,
        manufacturerWarrantyUntil: dateOrNull(dto.manufacturerWarrantyUntil) ?? null,
        photos: dto.photos ?? [],
        addressId: dto.addressId ?? customer.defaultAddressId ?? null,
        notes: dto.notes?.trim() || null,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
      select: APPLIANCE_SELECT,
    });
    return toApplianceView(row);
  }

  async update(actor: AuthPrincipal, id: string, dto: UpdateMyApplianceDto) {
    const customer = await this.ctx.requireCustomer(actor);
    await this.findOwned(actor.tenantId, customer.id, id);
    await this.validateRefs(actor.tenantId, customer.id, dto);
    const row = await this.prisma.client.customerAppliance.update({
      where: { id },
      data: {
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.brand !== undefined ? { brand: dto.brand.trim() } : {}),
        ...(dto.modelNumber !== undefined ? { modelNumber: dto.modelNumber?.trim() || null } : {}),
        ...(dto.serialNumber !== undefined ? { serialNumber: dto.serialNumber?.trim() || null } : {}),
        ...(dto.capacity !== undefined ? { capacity: dto.capacity?.trim() || null } : {}),
        ...(dto.installedLocation !== undefined ? { installedLocation: dto.installedLocation?.trim() || null } : {}),
        ...(dto.purchaseDate !== undefined ? { purchaseDate: dateOrNull(dto.purchaseDate) } : {}),
        ...(dto.installDate !== undefined ? { installDate: dateOrNull(dto.installDate) } : {}),
        ...(dto.manufacturerWarrantyUntil !== undefined
          ? { manufacturerWarrantyUntil: dateOrNull(dto.manufacturerWarrantyUntil) }
          : {}),
        ...(dto.photos !== undefined ? { photos: dto.photos } : {}),
        ...(dto.addressId !== undefined ? { addressId: dto.addressId } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
        updatedBy: actor.userId,
      },
      select: APPLIANCE_SELECT,
    });
    return toApplianceView(row);
  }

  async remove(actor: AuthPrincipal, id: string): Promise<{ ok: true }> {
    const customer = await this.ctx.requireCustomer(actor);
    await this.findOwned(actor.tenantId, customer.id, id);
    await this.prisma.client.customerAppliance.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: actor.userId },
    });
    return { ok: true };
  }

  private async findOwned(tenantId: string, customerId: string, id: string) {
    const row = await this.prisma.client.customerAppliance.findFirst({
      where: { id, tenantId, customerId, deletedAt: null },
      select: APPLIANCE_SELECT,
    });
    if (!row) throw new NotFoundException('Appliance not found');
    return row;
  }

  private async validateRefs(
    tenantId: string,
    customerId: string,
    dto: { addressId?: string | null; photos?: string[]; purchaseDate?: string | null; installDate?: string | null },
  ) {
    if (dto.addressId) {
      const addr = await this.prisma.client.address.findFirst({
        where: { id: dto.addressId, customerId, deletedAt: null },
        select: { id: true },
      });
      if (!addr) throw new BadRequestException('addressId does not belong to you');
    }
    if (dto.photos?.length && this.storage.isConfigured()) {
      for (const url of dto.photos) {
        if (!this.storage.isTenantObjectUrl(url, tenantId)) {
          throw new BadRequestException('Photos must be uploaded via /me/uploads/presign');
        }
      }
    }
    const now = Date.now();
    for (const d of [dto.purchaseDate, dto.installDate]) {
      if (d && new Date(d).getTime() > now + 86_400_000) {
        throw new BadRequestException('Purchase / install dates cannot be in the future');
      }
    }
  }
}
