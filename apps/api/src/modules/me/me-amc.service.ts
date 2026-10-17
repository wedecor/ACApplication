import type { AuthPrincipal } from '@ac/auth';
import { AMCSubscriptionStatus, InvoiceStatus, type ServiceCategory } from '@ac/types';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AmcSubscriptionsService } from '../amc/amc-subscriptions.service';
import { InvoicesService } from '../invoices/invoices.service';
import type { PurchaseAmcDto } from './dto/me-amc.dto';
import {
  categoryLabel,
  normalizeCategory,
  planFeatures,
  snapshotAppliances,
  toAppAmcStatus,
} from './me.mappers';
import { MeContextService } from './me-context.service';

export interface AmcSnapshotEntry {
  category: ServiceCategory;
  label: string;
  applianceId?: string;
  brand?: string;
}

/** A plan "covers" a category when it lists it, or lists nothing (all-appliance plan). AC_* are one family. */
export function planCoversCategory(covered: string[], category: string): boolean {
  if (!covered.length) return true;
  if (covered.includes(category)) return true;
  return category.startsWith('AC_') && covered.some((c) => c.startsWith('AC_'));
}

const OPEN_INVOICE_STATUSES = [InvoiceStatus.SENT, InvoiceStatus.OVERDUE, InvoiceStatus.PARTIALLY_PAID];

@Injectable()
export class MeAmcService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: MeContextService,
    private readonly subs: AmcSubscriptionsService,
    private readonly invoices: InvoicesService,
  ) {}

  /** Active plans in the app's `AmcPlan` shape. */
  async plans(actor: AuthPrincipal) {
    const rows = await this.prisma.client.aMCPlan.findMany({
      where: { tenantId: actor.tenantId, isActive: true, deletedAt: null },
      orderBy: [{ priceMinor: 'asc' }, { name: 'asc' }],
    });
    const popularIdx = rows.length >= 3 ? 1 : -1;
    return rows.map((p, idx) => {
      const features = planFeatures(p.features);
      return {
        id: p.id,
        name: p.name,
        tagline:
          p.description ??
          `${p.includedVisits} visits over ${p.durationMonths} months${p.emergencySupport ? ' • emergency support' : ''}`,
        priceMinor: p.priceMinor,
        renewalPriceMinor: p.renewalPriceMinor,
        durationMonths: p.durationMonths,
        visitsIncluded: p.includedVisits,
        features: features.length
          ? features
          : [
              `${p.includedVisits} preventive maintenance visits`,
              ...(p.discountBps ? [`${p.discountBps / 100}% off repairs`] : []),
              ...(p.prioritySupport ? ['Priority scheduling'] : []),
            ],
        emergencyIncluded: p.emergencySupport,
        appliancesCovered: p.appliancesCovered,
        popular: idx === popularIdx || p.type === 'PREMIUM',
      };
    });
  }

  async mine(actor: AuthPrincipal) {
    const customer = await this.ctx.requireCustomer(actor);
    const rows = await this.prisma.client.aMCSubscription.findMany({
      where: { tenantId: actor.tenantId, customerId: customer.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { plan: { select: { id: true, name: true, includedVisits: true, emergencySupport: true } } },
      take: 50,
    });
    const now = new Date();
    return rows.map((s) => ({
      id: s.id,
      number: s.number,
      planId: s.planId,
      planName: s.plan.name,
      status: toAppAmcStatus(s.status, s.endsAt, now),
      startsAt: s.startsAt.toISOString(),
      expiresAt: s.endsAt.toISOString(),
      visitsTotal: s.plan.includedVisits,
      visitsRemaining: Math.max(0, s.plan.includedVisits - s.visitsCompleted),
      appliances: snapshotAppliances(s.appliancesSnapshot),
      emergencyIncluded: s.plan.emergencySupport,
      autoRenew: s.autoRenew,
    }));
  }

  /**
   * Self-service purchase: validates address + appliances (categories or my
   * registered appliance ids), reuses AmcSubscriptionsService.subscribe and
   * issues the invoice so it is immediately payable.
   */
  async purchase(actor: AuthPrincipal, dto: PurchaseAmcDto): Promise<{ subscriptionId: string; invoiceId: string }> {
    const customer = await this.ctx.requireCustomer(actor);
    const [plan, address] = await Promise.all([
      this.prisma.client.aMCPlan.findFirst({
        where: { id: dto.planId, tenantId: actor.tenantId, isActive: true, deletedAt: null },
        select: { id: true, appliancesCovered: true },
      }),
      this.prisma.client.address.findFirst({
        where: { id: dto.addressId, customerId: customer.id, deletedAt: null },
        select: { id: true },
      }),
    ]);
    if (!plan) throw new NotFoundException('Plan not found');
    if (!address) throw new BadRequestException('addressId does not belong to you');

    const snapshot = await this.resolveAppliances(actor.tenantId, customer.id, dto.appliances);
    const uncovered = snapshot.filter((s) => !planCoversCategory(plan.appliancesCovered, s.category));
    if (uncovered.length) {
      throw new BadRequestException(
        `This plan does not cover: ${[...new Set(uncovered.map((u) => categoryLabel(u.category)))].join(', ')}`,
      );
    }

    const { subscription, invoice } = await this.subs.subscribe(actor, {
      customerId: customer.id,
      planId: plan.id,
      // The column is JSON; richer entries ({category, applianceId, ...}) are
      // understood by the repair module's warranty / coverage checks.
      appliancesSnapshot: snapshot as unknown as ServiceCategory[],
      autoRenew: dto.autoRenew ?? true,
    });
    await this.prisma.client.aMCSubscription.update({
      where: { id: subscription.id },
      data: { metadata: { source: 'customer-app', addressId: address.id } },
    });
    await this.invoices.send(actor, invoice.id);
    return { subscriptionId: subscription.id, invoiceId: invoice.id };
  }

  /** Raises (or returns the already-open) renewal invoice for my subscription. */
  async renew(actor: AuthPrincipal, id: string): Promise<{ invoiceId: string }> {
    const customer = await this.ctx.requireCustomer(actor);
    const sub = await this.prisma.client.aMCSubscription.findFirst({
      where: { id, tenantId: actor.tenantId, customerId: customer.id, deletedAt: null },
      include: { plan: { select: { name: true, durationMonths: true, isActive: true, renewalPriceMinor: true, priceMinor: true } } },
    });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (sub.status === AMCSubscriptionStatus.CANCELLED) {
      throw new ConflictException('Cancelled subscriptions cannot be renewed — buy a new plan instead');
    }
    if (sub.status === AMCSubscriptionStatus.PENDING_PAYMENT) {
      throw new ConflictException('Complete the pending payment for this subscription first');
    }
    if (!sub.plan.isActive) throw new ConflictException('This plan is no longer offered');

    const open = await this.prisma.client.invoice.findFirst({
      where: {
        tenantId: actor.tenantId,
        amcSubscriptionId: sub.id,
        customerId: customer.id,
        status: { in: OPEN_INVOICE_STATUSES },
        dueAmountMinor: { gt: 0 },
        createdAt: { gte: sub.startsAt },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (open) return { invoiceId: open.id };

    const price = sub.renewalPriceMinor || sub.plan.renewalPriceMinor || sub.priceMinor || sub.plan.priceMinor;
    const invoice = await this.invoices.createFromLineItems(
      actor,
      customer.id,
      [
        {
          description: `${sub.plan.name} renewal — ${sub.plan.durationMonths} months`,
          quantity: 1,
          unitPriceMinor: price,
          taxRateBps: 1800,
        },
      ],
      {
        amcSubscriptionId: sub.id,
        dueDate: new Date(Date.now() + 7 * 86_400_000),
        notes: `Renewal of AMC subscription ${sub.number}`,
      },
    );
    await this.invoices.send(actor, invoice.id);
    return { invoiceId: invoice.id };
  }

  private async resolveAppliances(
    tenantId: string,
    customerId: string,
    entries: string[],
  ): Promise<AmcSnapshotEntry[]> {
    const out: AmcSnapshotEntry[] = [];
    const ids: string[] = [];
    for (const e of entries) {
      const cat = normalizeCategory(e);
      if (cat) out.push({ category: cat, label: categoryLabel(cat) });
      else ids.push(e);
    }
    if (ids.length) {
      const owned = await this.prisma.client.customerAppliance.findMany({
        where: { id: { in: ids }, tenantId, customerId, deletedAt: null },
        select: { id: true, category: true, brand: true, modelNumber: true },
      });
      if (owned.length !== new Set(ids).size) {
        throw new BadRequestException('Unknown appliance in selection');
      }
      for (const a of owned) {
        out.push({
          category: a.category,
          label: `${a.brand} ${categoryLabel(a.category)}`,
          applianceId: a.id,
          brand: a.brand,
        });
      }
    }
    if (!out.length) throw new BadRequestException('Select at least one appliance');
    return out;
  }
}
