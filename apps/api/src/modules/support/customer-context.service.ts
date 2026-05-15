import { Injectable, NotFoundException } from '@nestjs/common';

import type { AuthPrincipal } from '@ac/auth';

import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Right-hand "customer context" pane on the agent inbox. Aggregates the
 * customer's bookings, AMC subscriptions, recent payments, technician
 * history, and previous tickets into a single payload — the UI never has
 * to make N+1 calls.
 *
 * The query budget here is intentionally small (5 tables) so the inbox
 * page stays under 200ms even on customers with deep history.
 */
@Injectable()
export class CustomerContextService {
  constructor(private readonly prisma: PrismaService) {}

  async getContext(actor: AuthPrincipal, customerId: string): Promise<{
    customer: unknown;
    bookings: unknown[];
    amcSubscriptions: unknown[];
    invoices: unknown[];
    payments: unknown[];
    tickets: unknown[];
    valueScore: number;
  }> {
    const customer = await this.prisma.client.customer.findFirst({
      where: { id: customerId, tenantId: actor.tenantId, deletedAt: null },
      include: {
        defaultAddress: true,
        addresses: { take: 5 },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            lastLoginAt: true,
          },
        },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    const [bookings, amc, invoices, payments, tickets] = await Promise.all([
      this.prisma.client.booking.findMany({
        where: { customerId, tenantId: actor.tenantId, deletedAt: null },
        orderBy: { scheduledAt: 'desc' },
        take: 10,
        include: {
          technician: { select: { id: true, fullName: true } },
          invoice: { select: { id: true, number: true, status: true, totalMinor: true } },
        },
      }),
      this.prisma.client.aMCSubscription.findMany({
        where: { customerId, tenantId: actor.tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { plan: { select: { id: true, name: true, type: true } } },
      }),
      this.prisma.client.invoice.findMany({
        where: { customerId, tenantId: actor.tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.client.payment.findMany({
        where: {
          invoice: { customerId, tenantId: actor.tenantId },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.client.supportTicket.findMany({
        where: { customerId, tenantId: actor.tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          number: true,
          subject: true,
          status: true,
          priority: true,
          createdAt: true,
          resolvedAt: true,
          satisfactionRating: true,
        },
      }),
    ]);

    // Lightweight customer-value score: lifetimeValue scaled + AMC active
    // + recent activity. Capped at 100.
    const lifetimeValue = Number(customer.lifetimeValueMinor) / 100;
    const hasActiveAmc = amc.some((s) => (s.status as string) === 'ACTIVE');
    const score = Math.min(
      100,
      Math.round(
        Math.log10(lifetimeValue + 1) * 25 + (hasActiveAmc ? 20 : 0) + Math.min(20, bookings.length),
      ),
    );

    return {
      customer,
      bookings,
      amcSubscriptions: amc,
      invoices,
      payments,
      tickets,
      valueScore: score,
    };
  }
}
