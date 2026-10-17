import type { AuthPrincipal } from '@ac/auth';
import type { Address } from '@ac/database';
import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import type { CreateMyAddressDto, UpdateMyAddressDto } from './dto/me-profile.dto';
import { toAppAddressLabel } from './me.mappers';
import { MeContextService } from './me-context.service';

export function toAddressView(a: Address, defaultAddressId: string | null) {
  return {
    id: a.id,
    label: toAppAddressLabel(a.label),
    line1: a.line1,
    line2: a.line2,
    city: a.city,
    state: a.state,
    pincode: a.pincode,
    landmark: a.landmark,
    isDefault: a.id === defaultAddressId,
    lat: a.latitude,
    lng: a.longitude,
  };
}

@Injectable()
export class MeAddressesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: MeContextService,
  ) {}

  async list(actor: AuthPrincipal) {
    const customer = await this.ctx.requireCustomer(actor);
    const rows = await this.prisma.client.address.findMany({
      where: { customerId: customer.id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return rows
      .map((a) => toAddressView(a, customer.defaultAddressId))
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  }

  async create(actor: AuthPrincipal, dto: CreateMyAddressDto) {
    const customer = await this.ctx.requireCustomer(actor);
    const state = dto.state ?? (await this.stateForCity(actor.tenantId, dto.city));
    const existing = await this.prisma.client.address.count({ where: { customerId: customer.id, deletedAt: null } });
    const row = await this.prisma.client.address.create({
      data: {
        customerId: customer.id,
        label: dto.label,
        line1: dto.line1.trim(),
        line2: dto.line2?.trim() || null,
        landmark: dto.landmark?.trim() || null,
        city: dto.city.trim(),
        state,
        pincode: dto.pincode,
        latitude: dto.lat ?? null,
        longitude: dto.lng ?? null,
      },
    });
    let defaultId = customer.defaultAddressId;
    if (dto.setDefault || existing === 0 || !defaultId) {
      await this.setDefaultRaw(customer.id, row.id);
      defaultId = row.id;
    }
    return toAddressView(row, defaultId);
  }

  async update(actor: AuthPrincipal, id: string, dto: UpdateMyAddressDto) {
    const customer = await this.ctx.requireCustomer(actor);
    await this.findOwned(customer.id, id);
    const row = await this.prisma.client.address.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.line1 !== undefined ? { line1: dto.line1.trim() } : {}),
        ...(dto.line2 !== undefined ? { line2: dto.line2?.trim() || null } : {}),
        ...(dto.landmark !== undefined ? { landmark: dto.landmark?.trim() || null } : {}),
        ...(dto.city !== undefined ? { city: dto.city.trim() } : {}),
        ...(dto.state !== undefined ? { state: dto.state } : {}),
        ...(dto.pincode !== undefined ? { pincode: dto.pincode } : {}),
        ...(dto.lat !== undefined ? { latitude: dto.lat } : {}),
        ...(dto.lng !== undefined ? { longitude: dto.lng } : {}),
      },
    });
    let defaultId = customer.defaultAddressId;
    if (dto.setDefault || dto.isDefault) {
      await this.setDefaultRaw(customer.id, id);
      defaultId = id;
    }
    return toAddressView(row, defaultId);
  }

  async remove(actor: AuthPrincipal, id: string): Promise<{ ok: true }> {
    const customer = await this.ctx.requireCustomer(actor);
    await this.findOwned(customer.id, id);
    // Bookings keep an `addressSnapshot`, so a soft delete never breaks history.
    await this.prisma.client.address.update({ where: { id }, data: { deletedAt: new Date() } });
    if (customer.defaultAddressId === id) {
      const next = await this.prisma.client.address.findFirst({
        where: { customerId: customer.id, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      await this.prisma.client.customer.update({
        where: { id: customer.id },
        data: { defaultAddressId: next?.id ?? null },
      });
    }
    return { ok: true };
  }

  async setDefault(actor: AuthPrincipal, id: string): Promise<{ ok: true }> {
    const customer = await this.ctx.requireCustomer(actor);
    await this.findOwned(customer.id, id);
    await this.setDefaultRaw(customer.id, id);
    return { ok: true };
  }

  private async setDefaultRaw(customerId: string, addressId: string) {
    await this.prisma.client.customer.update({ where: { id: customerId }, data: { defaultAddressId: addressId } });
  }

  private async findOwned(customerId: string, id: string) {
    const row = await this.prisma.client.address.findFirst({
      where: { id, customerId, deletedAt: null },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Address not found');
    return row;
  }

  private async stateForCity(tenantId: string, city: string): Promise<string> {
    const c = await this.prisma.client.city.findFirst({
      where: { tenantId, name: { equals: city.trim(), mode: 'insensitive' } },
      select: { state: true },
    });
    return c?.state ?? '';
  }
}
