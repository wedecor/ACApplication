/**
 * Finance analytics — aggregations powering the Admin CRM dashboards.
 *
 * Every aggregation is scoped to the tenant and accepts a date window so
 * the UI can re-fetch with day/week/month/quarter ranges. We use Prisma
 * `groupBy` + raw SQL where it's measurably faster — both paths return
 * the same shape so the controller is provider-agnostic.
 */

import { Injectable } from '@nestjs/common';

import {
  AMCSubscriptionStatus,
  CommissionStatus,
  InvoiceStatus,
  PaymentTransactionStatus,
  PayoutStatus,
  RefundStatus,
} from '@ac/types';

import { PrismaService } from '../../common/prisma/prisma.service';

export interface DateRange {
  from: Date;
  to: Date;
}

export interface FinanceOverview {
  revenueMinor: number;
  outstandingMinor: number;
  collectedMinor: number;
  refundedMinor: number;
  gstCollectedMinor: number;
  invoicesIssued: number;
  invoicesPaid: number;
  invoicesOverdue: number;
  averageInvoiceMinor: number;
  paymentSuccessRate: number;
  refundRatio: number;
  pendingPayoutsMinor: number;
  activeSubscriptions: number;
  expiringIn14Days: number;
}

@Injectable()
export class FinanceAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(tenantId: string, range: DateRange): Promise<FinanceOverview> {
    const baseInvoice = {
      tenantId,
      issueDate: { gte: range.from, lt: range.to },
    };

    const [
      totalIssued,
      totalPaid,
      sumTotals,
      collected,
      gstAgg,
      refundedAgg,
      overdue,
      txStatus,
      pendingPayouts,
      activeSubs,
      expiringSubs,
    ] = await Promise.all([
      this.prisma.client.invoice.count({
        where: { ...baseInvoice, status: { not: InvoiceStatus.DRAFT } },
      }),
      this.prisma.client.invoice.count({
        where: { ...baseInvoice, status: InvoiceStatus.PAID },
      }),
      this.prisma.client.invoice.aggregate({
        where: { ...baseInvoice, status: { not: InvoiceStatus.DRAFT } },
        _sum: { totalMinor: true, dueAmountMinor: true, amountPaidMinor: true, taxMinor: true },
        _avg: { totalMinor: true },
      }),
      this.prisma.client.payment.aggregate({
        where: {
          tenantId,
          status: 'CAPTURED',
          capturedAt: { gte: range.from, lt: range.to },
        },
        _sum: { amountMinor: true },
      }),
      this.prisma.client.invoice.aggregate({
        where: { ...baseInvoice, status: { not: InvoiceStatus.DRAFT } },
        _sum: { taxMinor: true },
      }),
      this.prisma.client.refund.aggregate({
        where: {
          tenantId,
          status: RefundStatus.COMPLETED,
          processedAt: { gte: range.from, lt: range.to },
        },
        _sum: { amountMinor: true },
      }),
      this.prisma.client.invoice.count({
        where: {
          tenantId,
          dueDate: { lt: new Date() },
          dueAmountMinor: { gt: 0 },
          status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID] },
        },
      }),
      this.prisma.client.paymentTransaction.groupBy({
        by: ['status'],
        where: { tenantId, createdAt: { gte: range.from, lt: range.to } },
        _count: { _all: true },
      }),
      this.prisma.client.technicianCommission.aggregate({
        where: {
          tenantId,
          status: { in: [CommissionStatus.ACCRUED, CommissionStatus.ADJUSTED] },
          payoutId: null,
        },
        _sum: { netMinor: true },
      }),
      this.prisma.client.aMCSubscription.count({
        where: { tenantId, status: AMCSubscriptionStatus.ACTIVE },
      }),
      this.prisma.client.aMCSubscription.count({
        where: {
          tenantId,
          status: AMCSubscriptionStatus.ACTIVE,
          endsAt: {
            gte: new Date(),
            lt: new Date(Date.now() + 14 * 86_400_000),
          },
        },
      }),
    ]);

    const captured =
      txStatus.find((r) => r.status === PaymentTransactionStatus.CAPTURED)?._count?._all ?? 0;
    const allTx = txStatus.reduce((s, r) => s + r._count._all, 0);
    const revenueMinor = sumTotals._sum.totalMinor ?? 0;
    const collectedMinor = collected._sum.amountMinor ?? 0;
    const refundedMinor = refundedAgg._sum.amountMinor ?? 0;

    return {
      revenueMinor,
      outstandingMinor: sumTotals._sum.dueAmountMinor ?? 0,
      collectedMinor,
      refundedMinor,
      gstCollectedMinor: gstAgg._sum.taxMinor ?? 0,
      invoicesIssued: totalIssued,
      invoicesPaid: totalPaid,
      invoicesOverdue: overdue,
      averageInvoiceMinor: Math.round(sumTotals._avg.totalMinor ?? 0),
      paymentSuccessRate: allTx === 0 ? 0 : captured / allTx,
      refundRatio: revenueMinor === 0 ? 0 : refundedMinor / revenueMinor,
      pendingPayoutsMinor: pendingPayouts._sum.netMinor ?? 0,
      activeSubscriptions: activeSubs,
      expiringIn14Days: expiringSubs,
    };
  }

  /** Daily revenue series — perfect for a stacked bar / area chart. */
  async revenueSeries(tenantId: string, range: DateRange) {
    return this.prisma.client.$queryRaw<
      Array<{ day: Date; revenue_minor: bigint; collected_minor: bigint; tax_minor: bigint }>
    >`
      SELECT date_trunc('day', i."issueDate") AS day,
             SUM(i."totalMinor")::bigint     AS revenue_minor,
             SUM(i."amountPaidMinor")::bigint AS collected_minor,
             SUM(i."taxMinor")::bigint       AS tax_minor
      FROM "invoices" i
      WHERE i."tenantId" = ${tenantId}
        AND i."issueDate" >= ${range.from}
        AND i."issueDate" <  ${range.to}
        AND i."status" <> 'DRAFT'
      GROUP BY 1
      ORDER BY 1 ASC
    `;
  }

  /** Top customers by lifetime invoiced value within window. */
  async topCustomers(tenantId: string, range: DateRange, limit = 10) {
    return this.prisma.client.$queryRaw<
      Array<{
        customer_id: string;
        full_name: string;
        invoiced: bigint;
        paid: bigint;
        outstanding: bigint;
        invoices: bigint;
      }>
    >`
      SELECT c."id"                AS customer_id,
             c."fullName"          AS full_name,
             SUM(i."totalMinor")::bigint     AS invoiced,
             SUM(i."amountPaidMinor")::bigint AS paid,
             SUM(i."dueAmountMinor")::bigint AS outstanding,
             COUNT(i.*)::bigint    AS invoices
      FROM "invoices" i
      JOIN "customers" c ON c."id" = i."customerId"
      WHERE i."tenantId" = ${tenantId}
        AND i."issueDate" >= ${range.from}
        AND i."issueDate" <  ${range.to}
        AND i."status" <> 'DRAFT'
      GROUP BY c."id", c."fullName"
      ORDER BY invoiced DESC
      LIMIT ${limit}
    `;
  }

  /** Revenue by city (joined via Booking → City). */
  async revenueByCity(tenantId: string, range: DateRange) {
    return this.prisma.client.$queryRaw<
      Array<{ city_id: string; city: string; revenue_minor: bigint; bookings: bigint }>
    >`
      SELECT ct."id"   AS city_id,
             ct."name" AS city,
             COALESCE(SUM(i."totalMinor"),0)::bigint AS revenue_minor,
             COUNT(b.*)::bigint AS bookings
      FROM "bookings" b
      JOIN "cities" ct ON ct."id" = b."cityId"
      LEFT JOIN "invoices" i ON i."bookingId" = b."id" AND i."status" <> 'DRAFT'
      WHERE b."tenantId" = ${tenantId}
        AND b."createdAt" >= ${range.from}
        AND b."createdAt" <  ${range.to}
      GROUP BY ct."id", ct."name"
      ORDER BY revenue_minor DESC
    `;
  }

  /** Aging buckets for outstanding invoices: 0-30 / 31-60 / 61-90 / >90 days. */
  async outstandingAging(tenantId: string) {
    const today = new Date();
    const stride = (d: number) => new Date(today.getTime() - d * 86_400_000);
    const sumIn = (from: Date | null, to: Date | null) =>
      this.prisma.client.invoice.aggregate({
        where: {
          tenantId,
          status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID] },
          dueAmountMinor: { gt: 0 },
          dueDate: {
            lt: to ?? new Date(today.getTime() + 365 * 86_400_000),
            ...(from ? { gte: from } : {}),
          },
        },
        _sum: { dueAmountMinor: true },
        _count: true,
      });
    const [b0, b30, b60, b90] = await Promise.all([
      sumIn(stride(30), null),
      sumIn(stride(60), stride(30)),
      sumIn(stride(90), stride(60)),
      sumIn(null, stride(90)),
    ]);
    return [
      { bucket: '0–30', amountMinor: b0._sum.dueAmountMinor ?? 0, count: b0._count },
      { bucket: '31–60', amountMinor: b30._sum.dueAmountMinor ?? 0, count: b30._count },
      { bucket: '61–90', amountMinor: b60._sum.dueAmountMinor ?? 0, count: b60._count },
      { bucket: '>90', amountMinor: b90._sum.dueAmountMinor ?? 0, count: b90._count },
    ];
  }

  /** Payouts pipeline — counts by status, in last 90 days. */
  async payoutPipeline(tenantId: string) {
    const since = new Date(Date.now() - 90 * 86_400_000);
    const rows = await this.prisma.client.technicianPayout.groupBy({
      by: ['status'],
      where: { tenantId, createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { netMinor: true },
    });
    const known: PayoutStatus[] = [
      PayoutStatus.PENDING,
      PayoutStatus.APPROVED,
      PayoutStatus.PROCESSING,
      PayoutStatus.PAID,
      PayoutStatus.FAILED,
    ];
    return known.map((s) => {
      const row = rows.find((r) => r.status === s);
      return { status: s, count: row?._count?._all ?? 0, totalMinor: row?._sum?.netMinor ?? 0 };
    });
  }
}
