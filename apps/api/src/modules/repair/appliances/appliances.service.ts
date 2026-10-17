import type { AuthPrincipal } from '@ac/auth';
import type { Prisma } from '@ac/database';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { compact, toDateInput, toNullableString } from '../domain/util';
import {
  type ApplianceWarrantyStatus,
  computeApplianceWarrantyStatus,
  planCoversCategory,
  snapshotIncludesAppliance,
} from '../domain/warranty';
import { CreateApplianceDto, ListAppliancesDto, UpdateApplianceDto } from './dto/appliance.dto';

const APPLIANCE_INCLUDE = {
  customer: { select: { id: true, fullName: true, phone: true } },
  address: { select: { id: true, line1: true, line2: true, city: true, pincode: true } },
  _count: { select: { bookings: true, jobCards: true, warrantyClaims: true } },
} satisfies Prisma.CustomerApplianceInclude;

export interface HistoryEntry {
  type: 'booking' | 'jobCard' | 'warrantyClaim';
  id: string;
  at: Date;
  title: string;
  status: string;
  bookingId: string | null;
}

@Injectable()
export class AppliancesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: AuthPrincipal, query: ListAppliancesDto) {
    const q = (query.q ?? query.search)?.trim();
    const where: Prisma.CustomerApplianceWhereInput = {
      tenantId: actor.tenantId,
      deletedAt: null,
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.serial
        ? { serialNumber: { equals: query.serial.trim(), mode: 'insensitive' } }
        : {}),
      ...(q
        ? {
            OR: [
              { brand: { contains: q, mode: 'insensitive' } },
              { modelNumber: { contains: q, mode: 'insensitive' } },
              { serialNumber: { contains: q, mode: 'insensitive' } },
              { customer: { fullName: { contains: q, mode: 'insensitive' } } },
              { customer: { phone: { contains: q } } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.client.$transaction([
      this.prisma.client.customerAppliance.findMany({
        where,
        include: APPLIANCE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.client.customerAppliance.count({ where }),
    ]);
    return { items, total };
  }

  async create(actor: AuthPrincipal, dto: CreateApplianceDto) {
    const customer = await this.prisma.client.customer.findFirst({
      where: { id: dto.customerId, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    if (dto.addressId) await this.assertAddress(dto.customerId, dto.addressId);

    return this.prisma.client.customerAppliance.create({
      data: {
        tenantId: actor.tenantId,
        customerId: dto.customerId,
        addressId: dto.addressId ?? null,
        category: dto.category,
        brand: dto.brand.trim(),
        modelNumber: toNullableString(dto.modelNumber) ?? null,
        serialNumber: toNullableString(dto.serialNumber) ?? null,
        capacity: toNullableString(dto.capacity) ?? null,
        installedLocation: toNullableString(dto.installedLocation) ?? null,
        purchaseDate: toDateInput(dto.purchaseDate) ?? null,
        installDate: toDateInput(dto.installDate) ?? null,
        manufacturerWarrantyUntil: toDateInput(dto.manufacturerWarrantyUntil) ?? null,
        extendedWarrantyUntil: toDateInput(dto.extendedWarrantyUntil) ?? null,
        warrantyProvider: toNullableString(dto.warrantyProvider) ?? null,
        purchaseInvoiceUrl: toNullableString(dto.purchaseInvoiceUrl) ?? null,
        photos: dto.photos ?? [],
        notes: toNullableString(dto.notes) ?? null,
        customFields: (dto.customFields ?? {}) as Prisma.InputJsonValue,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
      include: APPLIANCE_INCLUDE,
    });
  }

  async get(actor: AuthPrincipal, id: string) {
    const row = await this.prisma.client.customerAppliance.findFirst({
      where: { id, tenantId: actor.tenantId, deletedAt: null },
      include: APPLIANCE_INCLUDE,
    });
    if (!row) throw new NotFoundException('Appliance not found');
    return row;
  }

  async update(actor: AuthPrincipal, id: string, dto: UpdateApplianceDto) {
    const existing = await this.get(actor, id);
    if (dto.addressId) await this.assertAddress(existing.customerId, dto.addressId);

    const data = compact({
      addressId: dto.addressId === undefined ? undefined : dto.addressId || null,
      category: dto.category,
      brand: dto.brand?.trim(),
      modelNumber: toNullableString(dto.modelNumber),
      serialNumber: toNullableString(dto.serialNumber),
      capacity: toNullableString(dto.capacity),
      installedLocation: toNullableString(dto.installedLocation),
      purchaseDate: toDateInput(dto.purchaseDate),
      installDate: toDateInput(dto.installDate),
      manufacturerWarrantyUntil: toDateInput(dto.manufacturerWarrantyUntil),
      extendedWarrantyUntil: toDateInput(dto.extendedWarrantyUntil),
      warrantyProvider: toNullableString(dto.warrantyProvider),
      purchaseInvoiceUrl: toNullableString(dto.purchaseInvoiceUrl),
      photos: dto.photos,
      notes: toNullableString(dto.notes),
      customFields: dto.customFields as Prisma.InputJsonValue | undefined,
    });

    return this.prisma.client.customerAppliance.update({
      where: { id },
      data: { ...data, updatedBy: actor.userId },
      include: APPLIANCE_INCLUDE,
    });
  }

  async remove(actor: AuthPrincipal, id: string) {
    await this.get(actor, id);
    await this.prisma.client.customerAppliance.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: actor.userId, updatedBy: actor.userId },
    });
    return { id, deleted: true };
  }

  /** Bookings + job cards + warranty claims for this unit, newest first. */
  async history(actor: AuthPrincipal, id: string) {
    await this.get(actor, id);
    const [bookings, jobCards, warrantyClaims] = await Promise.all([
      this.prisma.client.booking.findMany({
        where: { tenantId: actor.tenantId, applianceId: id },
        orderBy: { scheduledAt: 'desc' },
        select: {
          id: true,
          code: true,
          status: true,
          category: true,
          serviceType: true,
          serviceMode: true,
          scheduledAt: true,
          completedAt: true,
          isWarrantyRevisit: true,
          parentBookingId: true,
          repairWarrantyUntil: true,
          finalAmountMinor: true,
          estimatedAmountMinor: true,
          createdAt: true,
          technician: { select: { id: true, fullName: true } },
          catalogItem: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.client.jobCard.findMany({
        where: { tenantId: actor.tenantId, applianceId: id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          bookingId: true,
          status: true,
          symptoms: true,
          faultCodes: true,
          diagnosis: true,
          resolution: true,
          firstTimeFix: true,
          startedAt: true,
          completedAt: true,
          createdAt: true,
          booking: { select: { code: true } },
        },
      }),
      this.prisma.client.warrantyClaim.findMany({
        where: { tenantId: actor.tenantId, applianceId: id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          number: true,
          type: true,
          status: true,
          reason: true,
          originalBookingId: true,
          revisitBookingId: true,
          createdAt: true,
          decidedAt: true,
        },
      }),
    ]);

    const timeline: HistoryEntry[] = [
      ...bookings.map((b) => ({
        type: 'booking' as const,
        id: b.id,
        at: b.completedAt ?? b.scheduledAt,
        title: `${b.code}${b.isWarrantyRevisit ? ' (warranty revisit)' : ''}`,
        status: b.status,
        bookingId: b.id,
      })),
      ...jobCards.map((j) => ({
        type: 'jobCard' as const,
        id: j.id,
        at: j.completedAt ?? j.startedAt ?? j.createdAt,
        title: `Job card for ${j.booking.code}`,
        status: j.status,
        bookingId: j.bookingId,
      })),
      ...warrantyClaims.map((w) => ({
        type: 'warrantyClaim' as const,
        id: w.id,
        at: w.createdAt,
        title: `${w.number} · ${w.type}`,
        status: w.status,
        bookingId: w.originalBookingId,
      })),
    ].sort((a, b) => b.at.getTime() - a.at.getTime());

    return { bookings, jobCards, warrantyClaims, timeline };
  }

  async warrantyStatus(actor: AuthPrincipal, id: string): Promise<ApplianceWarrantyStatus> {
    const appliance = await this.get(actor, id);
    const [latestRepair, amcCovered] = await Promise.all([
      this.latestRepairWarranty(actor.tenantId, id),
      this.isAmcCovered(actor.tenantId, appliance),
    ]);
    return computeApplianceWarrantyStatus({
      manufacturerWarrantyUntil: appliance.manufacturerWarrantyUntil,
      extendedWarrantyUntil: appliance.extendedWarrantyUntil,
      latestRepair: latestRepair
        ? { bookingId: latestRepair.id, repairWarrantyUntil: latestRepair.repairWarrantyUntil }
        : null,
      amcCovered,
    });
  }

  /** Completed booking on this unit with the furthest-out repair guarantee. */
  latestRepairWarranty(tenantId: string, applianceId: string) {
    return this.prisma.client.booking.findFirst({
      where: {
        tenantId,
        applianceId,
        status: 'COMPLETED',
        repairWarrantyUntil: { not: null },
      },
      orderBy: { repairWarrantyUntil: 'desc' },
      select: { id: true, code: true, repairWarrantyUntil: true, completedAt: true },
    });
  }

  /** Is the appliance covered by one of the customer's live AMC subscriptions? */
  async isAmcCovered(
    tenantId: string,
    appliance: { id: string; customerId: string; category: string },
    now: Date = new Date(),
  ): Promise<boolean> {
    const subs = await this.prisma.client.aMCSubscription.findMany({
      where: {
        tenantId,
        customerId: appliance.customerId,
        status: 'ACTIVE',
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      select: { appliancesSnapshot: true, plan: { select: { appliancesCovered: true } } },
    });
    return subs.some(
      (s) =>
        snapshotIncludesAppliance(s.appliancesSnapshot, appliance.id) ||
        planCoversCategory(s.plan.appliancesCovered, appliance.category),
    );
  }

  private async assertAddress(customerId: string, addressId: string): Promise<void> {
    const owned = await this.prisma.client.address.findFirst({
      where: { id: addressId, customerId },
      select: { id: true },
    });
    if (!owned) throw new BadRequestException('addressId does not belong to customer');
  }
}
