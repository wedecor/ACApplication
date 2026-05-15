/**
 * AMC Subscriptions — the recurring-revenue engine.
 *
 * Subscribe flow
 *  1. `subscribe()` creates a `PENDING_PAYMENT` subscription and an
 *     associated draft invoice for the plan price.
 *  2. When the invoice is paid (PaymentSucceeded → InvoicePaid) the
 *     event-listener flips the subscription to ACTIVE and seeds the visit
 *     calendar (one row per scheduled visit).
 *
 * Recurring visits
 *  • `generateVisitsForSubscription()` is idempotent — it tops the visit
 *    schedule up to `includedVisits` based on the plan's cadence.
 *  • A daily cron calls `materialiseImminentVisits()` to convert any visit
 *    whose `scheduledFor` falls in the next 24 h into an actual booking
 *    (so dispatch can assign a technician).
 *
 * Renewals
 *  • A daily cron raises `AmcSubscriptionExpiringSoon` events 14 / 7 / 1
 *    day(s) before `endsAt`.
 *  • 7 days before expiry the cron creates a renewal invoice if `autoRenew`.
 *  • On expiry day → status flips to EXPIRED.
 */

import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  AMCSubscriptionStatus,
  AMCVisitStatus,
  BookingStatus,
  DomainEventName,
} from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { PrismaService } from '../../common/prisma/prisma.service';
import { DomainEventBus } from '../../common/events/domain-event-bus.service';
import { nextDocumentNumber } from '../../common/finance';
import { InvoicesService } from '../invoices/invoices.service';
import { PdfService } from '../pdf/pdf.service';
import type { CreateAmcSubscriptionDto } from './dto/amc.dto';

@Injectable()
export class AmcSubscriptionsService {
  private readonly logger = new Logger(AmcSubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventBus,
    private readonly invoices: InvoicesService,
    private readonly pdf: PdfService,
  ) {}

  // ----------------------------------------------------- subscribe + cancel
  async subscribe(actor: AuthPrincipal, dto: CreateAmcSubscriptionDto) {
    const [customer, plan] = await Promise.all([
      this.prisma.client.customer.findFirst({
        where: { id: dto.customerId, tenantId: actor.tenantId },
        select: { id: true },
      }),
      this.prisma.client.aMCPlan.findFirst({
        where: { id: dto.planId, tenantId: actor.tenantId, isActive: true },
      }),
    ]);
    if (!customer) throw new NotFoundException('Customer not found');
    if (!plan) throw new NotFoundException('Active plan not found');

    const now = new Date();
    const endsAt = addMonths(now, plan.durationMonths);
    const number = await nextDocumentNumber(this.prisma, actor.tenantId, {
      prefix: 'AMC',
      table: 'amcSubscription',
    });

    const subscription = await this.prisma.client.aMCSubscription.create({
      data: {
        tenantId: actor.tenantId,
        number,
        customerId: dto.customerId,
        planId: plan.id,
        status: AMCSubscriptionStatus.PENDING_PAYMENT,
        startsAt: now,
        endsAt,
        priceMinor: plan.priceMinor,
        renewalPriceMinor: plan.renewalPriceMinor,
        autoRenew: dto.autoRenew ?? true,
        appliancesSnapshot:
          (dto.appliancesSnapshot ?? plan.appliancesCovered) as unknown as Prisma.InputJsonValue,
      },
    });

    // Raise an invoice for the signup price; on payment the listener flips
    // the subscription to ACTIVE + seeds visit schedule.
    const invoice = await this.invoices.createFromLineItems(
      actor,
      dto.customerId,
      [
        {
          description: `${plan.name} — annual contract (${plan.includedVisits} visits)`,
          quantity: 1,
          unitPriceMinor: plan.priceMinor,
          taxRateBps: 1800,
        },
      ],
      {
        amcSubscriptionId: subscription.id,
        dueDate: new Date(Date.now() + 7 * 86_400_000),
        notes: `AMC subscription ${subscription.number}`,
      },
    );

    this.events.publish(DomainEventName.AmcSubscriptionCreated, {
      subscriptionId: subscription.id,
      customerId: subscription.customerId,
    } as never);
    return { subscription, invoice };
  }

  async cancel(actor: AuthPrincipal, id: string, reason?: string) {
    const sub = await this.prisma.client.aMCSubscription.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (sub.status === AMCSubscriptionStatus.CANCELLED)
      throw new ConflictException('Already cancelled');

    const updated = await this.prisma.client.aMCSubscription.update({
      where: { id },
      data: { status: AMCSubscriptionStatus.CANCELLED, cancelledAt: new Date() },
    });
    // Cancel future scheduled visits — keep completed/missed history.
    await this.prisma.client.aMCVisit.updateMany({
      where: { subscriptionId: id, status: AMCVisitStatus.SCHEDULED },
      data: { status: AMCVisitStatus.CANCELLED, cancelledAt: new Date() },
    });
    this.events.publish(DomainEventName.AmcSubscriptionCancelled, {
      subscriptionId: id,
      reason: reason ?? null,
    } as never);
    return updated;
  }

  /** Called by InvoicePaid listener when the parent invoice settles. */
  async onSubscriptionInvoicePaid(subscriptionId: string) {
    const sub = await this.prisma.client.aMCSubscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) return;
    if (sub.status === AMCSubscriptionStatus.ACTIVE) return;
    await this.prisma.client.aMCSubscription.update({
      where: { id: subscriptionId },
      data: { status: AMCSubscriptionStatus.ACTIVE },
    });
    await this.generateVisitsForSubscription(subscriptionId);
    this.events.publish(DomainEventName.AmcSubscriptionActivated, {
      subscriptionId,
      customerId: sub.customerId,
      status: AMCSubscriptionStatus.ACTIVE,
    } as never);
  }

  // ----------------------------------------------------------------- list / get
  async list(actor: AuthPrincipal, filter: { status?: AMCSubscriptionStatus; customerId?: string }) {
    return this.prisma.client.aMCSubscription.findMany({
      where: {
        tenantId: actor.tenantId,
        status: filter.status,
        customerId: filter.customerId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        plan: { select: { id: true, name: true, type: true } },
        customer: { select: { id: true, fullName: true, phone: true } },
      },
      take: 200,
    });
  }

  async get(actor: AuthPrincipal, id: string) {
    const sub = await this.prisma.client.aMCSubscription.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        plan: true,
        customer: { select: { id: true, fullName: true, phone: true, email: true } },
        visits: { orderBy: { visitNumber: 'asc' } },
        invoices: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!sub) throw new NotFoundException('Subscription not found');
    return sub;
  }

  // -------------------------------------------------------- visit generation
  async generateVisitsForSubscription(subscriptionId: string) {
    const sub = await this.prisma.client.aMCSubscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true, visits: true },
    });
    if (!sub) throw new NotFoundException('Subscription not found');

    if (sub.visits.length >= sub.plan.includedVisits) return sub;
    const created = await this.prisma.client.$transaction(async (tx) => {
      const start = sub.startsAt.getTime();
      const cadenceMs = sub.plan.visitCadenceDays * 86_400_000;
      const inserts: Prisma.AMCVisitCreateManyInput[] = [];
      for (let n = sub.visits.length + 1; n <= sub.plan.includedVisits; n += 1) {
        const scheduledFor = new Date(start + (n - 1) * cadenceMs);
        // Skip generation past contract end.
        if (scheduledFor > sub.endsAt) break;
        inserts.push({
          tenantId: sub.tenantId,
          subscriptionId: sub.id,
          visitNumber: n,
          status: AMCVisitStatus.SCHEDULED,
          scheduledFor,
          isComplimentary: true,
        });
      }
      if (inserts.length > 0) {
        await tx.aMCVisit.createMany({ data: inserts, skipDuplicates: true });
        await tx.aMCSubscription.update({
          where: { id: subscriptionId },
          data: { visitsScheduled: { increment: inserts.length } },
        });
        for (const visit of inserts) {
          this.events.publish(DomainEventName.AmcVisitScheduled, {
            visitId: 'pending',
            subscriptionId: sub.id,
            scheduledFor: (visit.scheduledFor as Date).toISOString(),
          } as never);
        }
      }
      return inserts.length;
    });
    this.logger.log(
      `Generated ${created} visit(s) for subscription ${sub.number}`,
    );
    return sub;
  }

  /**
   * Cron-driven: any SCHEDULED visit whose `scheduledFor` is in the next
   * 24 h becomes a real `Booking` so dispatch can pick a tech.
   */
  async materialiseImminentVisits(now = new Date()): Promise<number> {
    const horizon = new Date(now.getTime() + 24 * 3600 * 1000);
    const visits = await this.prisma.client.aMCVisit.findMany({
      where: {
        status: AMCVisitStatus.SCHEDULED,
        bookingId: null,
        scheduledFor: { lte: horizon },
      },
      include: {
        subscription: {
          include: {
            plan: true,
            customer: {
              select: { id: true, defaultAddressId: true, tenantId: true, cityId: true },
            },
          },
        },
      },
      take: 100,
    });

    let materialised = 0;
    for (const visit of visits) {
      const customer = visit.subscription.customer;
      if (!customer.defaultAddressId || !customer.cityId) {
        this.logger.warn(
          `Visit ${visit.id} cannot be materialised — customer missing address / city`,
        );
        continue;
      }
      const plan = visit.subscription.plan;
      const booking = await this.prisma.client.booking.create({
        data: {
          tenantId: customer.tenantId,
          customerId: customer.id,
          cityId: customer.cityId,
          addressId: customer.defaultAddressId,
          category: plan.appliancesCovered[0] ?? 'AC_REPAIR',
          code: `ACB-${Date.now()}-${visit.id.slice(-5)}`,
          status: BookingStatus.PENDING,
          scheduledAt: visit.scheduledFor,
          scheduledTimeSlot: '10:00-12:00',
          estimatedAmountMinor: 0,
          notes: `AMC visit ${visit.visitNumber} for subscription ${visit.subscription.number}`,
        },
        select: { id: true },
      });
      await this.prisma.client.aMCVisit.update({
        where: { id: visit.id },
        data: { bookingId: booking.id },
      });
      materialised += 1;
    }
    if (materialised > 0) this.logger.log(`Materialised ${materialised} AMC visit(s) as bookings`);
    return materialised;
  }

  /**
   * Cron-driven: send "expiring soon" notifications and create renewal
   * invoices for `autoRenew` subscriptions.
   */
  async runRenewalSweep(now = new Date()): Promise<{ reminders: number; renewals: number }> {
    const horizons = [14, 7, 1];
    let reminders = 0;
    for (const days of horizons) {
      const start = new Date(now.getTime() + days * 86_400_000);
      const end = new Date(start.getTime() + 86_400_000);
      const subs = await this.prisma.client.aMCSubscription.findMany({
        where: {
          status: AMCSubscriptionStatus.ACTIVE,
          endsAt: { gte: start, lt: end },
        },
        select: { id: true, customerId: true, tenantId: true },
      });
      for (const sub of subs) {
        this.events.publish(DomainEventName.AmcSubscriptionExpiringSoon, {
          subscriptionId: sub.id,
          customerId: sub.customerId,
          daysUntilExpiry: days,
        } as never);
        reminders += 1;
      }
    }

    // 7 days out, generate a renewal invoice for autoRenew subscriptions.
    const renewalStart = new Date(now.getTime() + 7 * 86_400_000);
    const renewalEnd = new Date(renewalStart.getTime() + 86_400_000);
    const renewable = await this.prisma.client.aMCSubscription.findMany({
      where: {
        status: AMCSubscriptionStatus.ACTIVE,
        autoRenew: true,
        endsAt: { gte: renewalStart, lt: renewalEnd },
      },
      include: { plan: true },
    });
    let renewals = 0;
    for (const sub of renewable) {
      // Skip if a renewal invoice was already raised.
      const existing = await this.prisma.client.invoice.findFirst({
        where: {
          amcSubscriptionId: sub.id,
          externalRef: `renewal:${sub.id}:${sub.endsAt.toISOString().slice(0, 10)}`,
        },
        select: { id: true },
      });
      if (existing) continue;

      await this.prisma.client.invoice.create({
        data: {
          tenantId: sub.tenantId,
          number: await nextDocumentNumber(this.prisma, sub.tenantId, {
            prefix: 'INV',
            table: 'invoice',
          }),
          customerId: sub.customerId,
          amcSubscriptionId: sub.id,
          status: 'DRAFT',
          subtotalMinor: sub.renewalPriceMinor,
          totalMinor: sub.renewalPriceMinor,
          dueAmountMinor: sub.renewalPriceMinor,
          currency: 'INR',
          gstEnabled: true,
          dueDate: sub.endsAt,
          notes: `Renewal of AMC subscription ${sub.number}`,
          externalRef: `renewal:${sub.id}:${sub.endsAt.toISOString().slice(0, 10)}`,
          lineItems: {
            create: [
              {
                description: `${sub.plan.name} renewal — ${sub.plan.durationMonths} months`,
                quantity: 1,
                unitPriceMinor: sub.renewalPriceMinor,
                taxRateBps: 1800,
                subtotalMinor: sub.renewalPriceMinor,
                taxMinor: 0,
                totalMinor: sub.renewalPriceMinor,
              },
            ],
          },
        },
      });
      this.events.publish(DomainEventName.AmcSubscriptionRenewed, {
        subscriptionId: sub.id,
        newEndsAt: sub.endsAt.toISOString(),
      } as never);
      renewals += 1;
    }

    // Flip expired contracts.
    const expired = await this.prisma.client.aMCSubscription.updateMany({
      where: { status: AMCSubscriptionStatus.ACTIVE, endsAt: { lt: now } },
      data: { status: AMCSubscriptionStatus.EXPIRED },
    });
    if (expired.count > 0) {
      this.logger.log(`Expired ${expired.count} AMC subscription(s)`);
    }

    return { reminders, renewals };
  }

  /**
   * Missed-visit sweep: any SCHEDULED visit whose `scheduledFor` passed by
   * more than 48 h and which never materialised into a completed booking
   * becomes MISSED.
   */
  async runMissedVisitSweep(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - 48 * 3600 * 1000);
    const stale = await this.prisma.client.aMCVisit.findMany({
      where: {
        status: AMCVisitStatus.SCHEDULED,
        scheduledFor: { lt: cutoff },
      },
      take: 100,
    });
    let count = 0;
    for (const v of stale) {
      await this.prisma.client.aMCVisit.update({
        where: { id: v.id },
        data: { status: AMCVisitStatus.MISSED, missedAt: now },
      });
      this.events.publish(DomainEventName.AmcVisitMissed, {
        visitId: v.id,
        subscriptionId: v.subscriptionId,
      } as never);
      count += 1;
    }
    return count;
  }

  async renderContract(actor: AuthPrincipal, id: string) {
    const sub = await this.get(actor, id);
    return this.pdf.amcContract({
      subscription: {
        number: sub.number,
        startsAt: sub.startsAt,
        endsAt: sub.endsAt,
        priceMinor: sub.priceMinor,
        currency: 'INR',
        visitsScheduled: sub.visitsScheduled,
        autoRenew: sub.autoRenew,
      },
      plan: {
        name: sub.plan.name,
        type: sub.plan.type,
        includedVisits: sub.plan.includedVisits,
        description: sub.plan.description,
        features: Array.isArray(sub.plan.features) ? (sub.plan.features as string[]) : [],
        emergencySupport: sub.plan.emergencySupport,
        prioritySupport: sub.plan.prioritySupport,
      },
      customer: {
        name: sub.customer.fullName,
        email: sub.customer.email,
        phone: sub.customer.phone,
        address: null,
      },
    });
  }
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}
