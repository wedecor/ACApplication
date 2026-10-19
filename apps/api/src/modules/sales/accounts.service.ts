import type { AuthPrincipal } from '@ac/auth';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import type {
  CreateAccountDto,
  LinkCustomersDto,
  ListAccountsDto,
  UpdateAccountDto,
} from './dto/account.dto';

const OUTSTANDING_INVOICE_STATUSES = ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] as const;

function normaliseTags(tags: string[] | undefined): string[] | undefined {
  if (!tags) return undefined;
  return [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: AuthPrincipal, query: ListAccountsDto) {
    const where: Prisma.AccountWhereInput = {
      tenantId: actor.tenantId,
      deletedAt: null,
      ...(query.type ? { type: query.type } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { gstin: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search } },
              { billingEmail: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.client.$transaction([
      this.prisma.client.account.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
        include: {
          _count: {
            select: {
              customers: { where: { deletedAt: null } },
              opportunities: { where: { deletedAt: null } },
            },
          },
        },
      }),
      this.prisma.client.account.count({ where }),
    ]);
    return { items, total };
  }

  async create(actor: AuthPrincipal, dto: CreateAccountDto) {
    if (dto.cityId) await this.assertCity(dto.cityId);
    return this.prisma.client.account.create({
      data: {
        tenantId: actor.tenantId,
        name: dto.name.trim(),
        type: dto.type,
        gstin: dto.gstin?.toUpperCase() ?? null,
        billingEmail: dto.billingEmail?.toLowerCase() ?? null,
        phone: dto.phone ?? null,
        ownerUserId: dto.ownerUserId ?? null,
        addressLine: dto.addressLine ?? null,
        cityId: dto.cityId ?? null,
        notes: dto.notes ?? null,
        tags: normaliseTags(dto.tags) ?? [],
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
    });
  }

  async get(actor: AuthPrincipal, id: string) {
    const account = await this.findOrThrow(actor.tenantId, id);
    const customers = await this.prisma.client.customer.findMany({
      where: { tenantId: actor.tenantId, accountId: id, deletedAt: null, mergedIntoId: null },
      select: { id: true, fullName: true, phone: true, email: true, totalBookings: true },
      orderBy: { fullName: 'asc' },
      take: 500,
    });
    const customerIds = customers.map((c) => c.id);

    const [
      bookingCount,
      completedBookingCount,
      activeAmcCount,
      revenue,
      outstanding,
      recentBookings,
      amcSubscriptions,
      opportunities,
    ] = await Promise.all([
      this.prisma.client.booking.count({
        where: { tenantId: actor.tenantId, customerId: { in: customerIds }, deletedAt: null },
      }),
      this.prisma.client.booking.count({
        where: {
          tenantId: actor.tenantId,
          customerId: { in: customerIds },
          deletedAt: null,
          status: 'COMPLETED',
        },
      }),
      this.prisma.client.aMCSubscription.count({
        where: {
          tenantId: actor.tenantId,
          customerId: { in: customerIds },
          deletedAt: null,
          status: 'ACTIVE',
        },
      }),
      this.prisma.client.invoice.aggregate({
        where: { tenantId: actor.tenantId, customerId: { in: customerIds }, deletedAt: null },
        _sum: { amountPaidMinor: true },
      }),
      this.prisma.client.invoice.aggregate({
        where: {
          tenantId: actor.tenantId,
          customerId: { in: customerIds },
          deletedAt: null,
          status: { in: [...OUTSTANDING_INVOICE_STATUSES] },
        },
        _sum: { dueAmountMinor: true },
      }),
      this.prisma.client.booking.findMany({
        where: { tenantId: actor.tenantId, customerId: { in: customerIds }, deletedAt: null },
        orderBy: { scheduledAt: 'desc' },
        take: 20,
        select: {
          id: true,
          code: true,
          status: true,
          category: true,
          scheduledAt: true,
          customerId: true,
          finalAmountMinor: true,
          customer: { select: { fullName: true } },
        },
      }),
      this.prisma.client.aMCSubscription.findMany({
        where: { tenantId: actor.tenantId, customerId: { in: customerIds }, deletedAt: null },
        orderBy: { endsAt: 'desc' },
        take: 50,
        select: {
          id: true,
          number: true,
          status: true,
          endsAt: true,
          customerId: true,
          plan: { select: { name: true } },
        },
      }),
      this.prisma.client.opportunity.findMany({
        where: { tenantId: actor.tenantId, accountId: id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, title: true, stage: true, valueMinor: true },
      }),
    ]);

    return {
      ...account,
      customers,
      stats: {
        customerCount: customers.length,
        bookingCount,
        completedBookingCount,
        activeAmcCount,
        revenueMinor: revenue._sum.amountPaidMinor ?? 0,
        outstandingMinor: outstanding._sum.dueAmountMinor ?? 0,
      },
      recentBookings: recentBookings.map((b) => ({
        id: b.id,
        code: b.code,
        status: b.status,
        category: b.category,
        scheduledAt: b.scheduledAt,
        customerId: b.customerId,
        customerName: b.customer.fullName,
        finalAmountMinor: b.finalAmountMinor,
      })),
      amcSubscriptions: amcSubscriptions.map((s) => ({
        id: s.id,
        number: s.number,
        status: s.status,
        endsAt: s.endsAt,
        customerId: s.customerId,
        planName: s.plan.name,
      })),
      opportunities,
    };
  }

  async update(actor: AuthPrincipal, id: string, dto: UpdateAccountDto) {
    await this.findOrThrow(actor.tenantId, id);
    if (dto.cityId) await this.assertCity(dto.cityId);
    return this.prisma.client.account.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.gstin !== undefined ? { gstin: dto.gstin.toUpperCase() } : {}),
        ...(dto.billingEmail !== undefined
          ? { billingEmail: dto.billingEmail.toLowerCase() }
          : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.ownerUserId !== undefined ? { ownerUserId: dto.ownerUserId } : {}),
        ...(dto.addressLine !== undefined ? { addressLine: dto.addressLine } : {}),
        ...(dto.cityId !== undefined ? { cityId: dto.cityId } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.tags !== undefined ? { tags: normaliseTags(dto.tags) } : {}),
        updatedBy: actor.userId,
      },
    });
  }

  async remove(actor: AuthPrincipal, id: string) {
    await this.findOrThrow(actor.tenantId, id);
    await this.prisma.client.$transaction([
      this.prisma.client.customer.updateMany({
        where: { tenantId: actor.tenantId, accountId: id },
        data: { accountId: null },
      }),
      this.prisma.client.account.update({
        where: { id },
        data: { deletedAt: new Date(), deletedBy: actor.userId, updatedBy: actor.userId },
      }),
    ]);
    return { ok: true as const };
  }

  async linkCustomers(actor: AuthPrincipal, id: string, dto: LinkCustomersDto) {
    await this.findOrThrow(actor.tenantId, id);
    const ids = [...new Set(dto.customerIds)];
    const found = await this.prisma.client.customer.count({
      where: { tenantId: actor.tenantId, id: { in: ids }, deletedAt: null },
    });
    if (found !== ids.length) throw new BadRequestException('One or more customers not found');
    const res = await this.prisma.client.customer.updateMany({
      where: { tenantId: actor.tenantId, id: { in: ids }, deletedAt: null },
      data: { accountId: id },
    });
    return { linked: res.count };
  }

  async unlinkCustomer(actor: AuthPrincipal, id: string, customerId: string) {
    await this.findOrThrow(actor.tenantId, id);
    const res = await this.prisma.client.customer.updateMany({
      where: { tenantId: actor.tenantId, id: customerId, accountId: id },
      data: { accountId: null },
    });
    if (res.count === 0) throw new NotFoundException('Customer is not linked to this account');
    return { ok: true as const };
  }

  private async findOrThrow(tenantId: string, id: string) {
    const account = await this.prisma.client.account.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  private async assertCity(cityId: string) {
    const city = await this.prisma.client.city.findFirst({ where: { id: cityId }, select: { id: true } });
    if (!city) throw new BadRequestException('City not found');
  }
}
