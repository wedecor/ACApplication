/**
 * Vendor management — the procurement-side counterpart to customers.
 *
 * Vendors carry contact info, GST profile, payment terms, performance
 * metrics (on-time rate, rating) and a lifetime spend rollup. Performance
 * counters are mutated by the purchase-order workflow when GRNs are posted
 * or POs are cancelled; this service owns the persistence of those numbers.
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { VendorStatus } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { PrismaService } from '../../common/prisma/prisma.service';
import type {
  CreateVendorDto,
  ListVendorsDto,
  RateVendorDto,
  UpdateVendorDto,
} from './dto/vendor.dto';

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(actor: AuthPrincipal, dto: CreateVendorDto) {
    const code = dto.code?.trim() || (await this.suggestCode(actor.tenantId, dto.companyName));
    const exists = await this.prisma.client.vendor.findFirst({
      where: { tenantId: actor.tenantId, code, deletedAt: null },
      select: { id: true },
    });
    if (exists) throw new ConflictException('Vendor code already exists');

    if (dto.gstin) {
      const dup = await this.prisma.client.vendor.findFirst({
        where: { tenantId: actor.tenantId, gstin: dto.gstin, deletedAt: null },
        select: { id: true },
      });
      if (dup) throw new ConflictException('A vendor with this GSTIN already exists');
    }

    return this.prisma.client.vendor.create({
      data: {
        tenantId: actor.tenantId,
        code,
        companyName: dto.companyName,
        legalName: dto.legalName ?? null,
        gstin: dto.gstin ?? null,
        pan: dto.pan ?? null,
        contactPerson: dto.contactPerson ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        addressLine1: dto.addressLine1 ?? null,
        addressLine2: dto.addressLine2 ?? null,
        city: dto.city ?? null,
        state: dto.state ?? null,
        pincode: dto.pincode ?? null,
        paymentTermsDays: dto.paymentTermsDays ?? 0,
        categoriesSupplied: dto.categoriesSupplied ?? [],
        bankName: dto.bankName ?? null,
        bankAccountNumber: dto.bankAccountNumber ?? null,
        ifsc: dto.ifsc ?? null,
        notes: dto.notes ?? null,
        status: dto.status ?? VendorStatus.ACTIVE,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
    });
  }

  async list(actor: AuthPrincipal, dto: ListVendorsDto) {
    const where: Prisma.VendorWhereInput = {
      tenantId: actor.tenantId,
      deletedAt: null,
    };
    if (dto.status) where.status = dto.status;
    if (dto.category) where.categoriesSupplied = { has: dto.category };
    if (dto.search) {
      where.OR = [
        { companyName: { contains: dto.search, mode: 'insensitive' } },
        { code: { contains: dto.search, mode: 'insensitive' } },
        { gstin: { contains: dto.search } },
        { phone: { contains: dto.search } },
        { email: { contains: dto.search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.client.vendor.findMany({
        where,
        orderBy: [{ status: 'asc' }, { companyName: 'asc' }],
        skip: dto.skip,
        take: dto.pageSize,
        include: { _count: { select: { purchaseOrders: true } } },
      }),
      this.prisma.client.vendor.count({ where }),
    ]);
    return { items, total, page: dto.page, pageSize: dto.pageSize };
  }

  async get(actor: AuthPrincipal, id: string) {
    const v = await this.prisma.client.vendor.findFirst({
      where: { id, tenantId: actor.tenantId, deletedAt: null },
      include: {
        purchaseOrders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            number: true,
            status: true,
            totalMinor: true,
            createdAt: true,
            expectedAt: true,
          },
        },
        _count: { select: { purchaseOrders: true, preferredItems: true } },
      },
    });
    if (!v) throw new NotFoundException('Vendor not found');
    return v;
  }

  async update(actor: AuthPrincipal, id: string, dto: UpdateVendorDto) {
    await this.assertVendor(actor.tenantId, id);
    return this.prisma.client.vendor.update({
      where: { id },
      data: { ...dto, updatedBy: actor.userId },
    });
  }

  async softDelete(actor: AuthPrincipal, id: string) {
    await this.assertVendor(actor.tenantId, id);
    const openPo = await this.prisma.client.purchaseOrder.count({
      where: {
        vendorId: id,
        status: { in: ['DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED'] },
        deletedAt: null,
      },
    });
    if (openPo > 0) throw new ConflictException('Vendor has open purchase orders');
    await this.prisma.client.vendor.update({
      where: { id },
      data: { deletedAt: new Date(), status: VendorStatus.BLACKLISTED, updatedBy: actor.userId },
    });
    return { ok: true };
  }

  /**
   * Record a manual rating (1–5). The on-time / lifetime-spend counters are
   * updated automatically by the PO workflow; this is the "soft" rating
   * humans give to a vendor.
   */
  async rate(actor: AuthPrincipal, id: string, dto: RateVendorDto) {
    const v = await this.assertVendor(actor.tenantId, id);
    if (dto.rating < 0 || dto.rating > 5) {
      throw new BadRequestException('Rating must be between 0 and 5');
    }
    // EMA so rolling reviews damp historical spikes.
    const alpha = 0.3;
    const next = v.rating === 0 ? dto.rating : v.rating * (1 - alpha) + dto.rating * alpha;
    return this.prisma.client.vendor.update({
      where: { id },
      data: { rating: next, updatedBy: actor.userId },
    });
  }

  // ---------------------------------------------------------------- internals
  private async assertVendor(tenantId: string, id: string) {
    const v = await this.prisma.client.vendor.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true, rating: true },
    });
    if (!v) throw new NotFoundException('Vendor not found');
    return v;
  }

  private async suggestCode(tenantId: string, companyName: string): Promise<string> {
    const slug = companyName
      .replace(/[^a-zA-Z]/g, '')
      .slice(0, 4)
      .toUpperCase() || 'VND';
    let candidate = `${slug}-${Math.floor(Math.random() * 9000 + 1000)}`;
    for (let i = 0; i < 20; i += 1) {
      const exists = await this.prisma.client.vendor.findFirst({
        where: { tenantId, code: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
      candidate = `${slug}-${Math.floor(Math.random() * 9000 + 1000)}`;
    }
    return `${slug}-${Date.now().toString().slice(-6)}`;
  }
}
