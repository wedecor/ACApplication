/**
 * AMC plans service — straight CRUD with light validation.
 *
 * Plans drive the catalogue page on the customer app and the dropdown in
 * the Admin CRM "Subscribe customer" dialog. The actual subscription
 * lifecycle lives in `AmcSubscriptionsService` — we keep these split so
 * plan edits never accidentally touch in-flight contracts.
 */

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type { AuthPrincipal } from '@ac/auth';

import { PrismaService } from '../../common/prisma/prisma.service';
import type { CreateAmcPlanDto, UpdateAmcPlanDto } from './dto/amc.dto';

@Injectable()
export class AmcPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async create(actor: AuthPrincipal, dto: CreateAmcPlanDto) {
    const existing = await this.prisma.client.aMCPlan.findUnique({
      where: { tenantId_slug: { tenantId: actor.tenantId, slug: dto.slug } },
      select: { id: true },
    });
    if (existing) throw new ConflictException(`Plan with slug "${dto.slug}" already exists`);
    return this.prisma.client.aMCPlan.create({
      data: {
        tenantId: actor.tenantId,
        slug: dto.slug.toLowerCase(),
        name: dto.name,
        type: dto.type,
        description: dto.description ?? null,
        durationMonths: dto.durationMonths,
        includedVisits: dto.includedVisits,
        emergencySupport: dto.emergencySupport ?? false,
        prioritySupport: dto.prioritySupport ?? false,
        discountBps: dto.discountBps ?? 0,
        appliancesCovered: dto.appliancesCovered,
        priceMinor: dto.priceMinor,
        renewalPriceMinor: dto.renewalPriceMinor ?? dto.priceMinor,
        visitCadenceDays:
          dto.visitCadenceDays ?? Math.floor((dto.durationMonths * 30) / dto.includedVisits),
        features: (dto.features ?? []) as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async update(actor: AuthPrincipal, id: string, dto: UpdateAmcPlanDto) {
    const plan = await this.prisma.client.aMCPlan.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    return this.prisma.client.aMCPlan.update({
      where: { id },
      data: {
        name: dto.name ?? plan.name,
        description: dto.description ?? plan.description,
        isActive: dto.isActive ?? plan.isActive,
        priceMinor: dto.priceMinor ?? plan.priceMinor,
        renewalPriceMinor: dto.renewalPriceMinor ?? plan.renewalPriceMinor,
        discountBps: dto.discountBps ?? plan.discountBps,
        features: (dto.features ?? plan.features) as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async list(actor: AuthPrincipal) {
    return this.prisma.client.aMCPlan.findMany({
      where: { tenantId: actor.tenantId, deletedAt: null },
      orderBy: [{ priceMinor: 'asc' }, { name: 'asc' }],
    });
  }

  async get(actor: AuthPrincipal, id: string) {
    const plan = await this.prisma.client.aMCPlan.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }
}
