import {
  PaymentTransactionStatus,
  PayoutStatus,
} from '@ac/types';

import {
  type DateRange,
  FinanceAnalyticsService,
} from '../finance-analytics.service';

describe('FinanceAnalyticsService', () => {
  let service: FinanceAnalyticsService;
  let prismaMock: {
    client: {
      invoice: {
        count: jest.Mock;
        aggregate: jest.Mock;
      };
      payment: {
        aggregate: jest.Mock;
      };
      refund: {
        aggregate: jest.Mock;
      };
      paymentTransaction: {
        groupBy: jest.Mock;
      };
      technicianCommission: {
        aggregate: jest.Mock;
      };
      aMCSubscription: {
        count: jest.Mock;
      };
      technicianPayout: {
        groupBy: jest.Mock;
      };
      $queryRaw: jest.Mock;
    };
  };

  const range: DateRange = {
    from: new Date('2026-10-01T00:00:00.000Z'),
    to: new Date('2026-10-31T23:59:59.999Z'),
  };
  const tenantId = 'tenant_1';

  beforeEach(() => {
    prismaMock = {
      client: {
        invoice: {
          count: jest.fn(),
          aggregate: jest.fn(),
        },
        payment: {
          aggregate: jest.fn(),
        },
        refund: {
          aggregate: jest.fn(),
        },
        paymentTransaction: {
          groupBy: jest.fn(),
        },
        technicianCommission: {
          aggregate: jest.fn(),
        },
        aMCSubscription: {
          count: jest.fn(),
        },
        technicianPayout: {
          groupBy: jest.fn(),
        },
        $queryRaw: jest.fn(),
      },
    };

    service = new FinanceAnalyticsService(prismaMock as never);
  });

  describe('overview', () => {
    it('returns the aggregated financial metrics with populated data', async () => {
      // 1. totalIssued
      prismaMock.client.invoice.count
        .mockResolvedValueOnce(50) // totalIssued
        .mockResolvedValueOnce(40) // totalPaid
        .mockResolvedValueOnce(5); // overdue

      prismaMock.client.aMCSubscription.count
        .mockResolvedValueOnce(15) // activeSubs
        .mockResolvedValueOnce(3); // expiringSubs

      // 3. sumTotals
      prismaMock.client.invoice.aggregate
        .mockResolvedValueOnce({
          _sum: {
            totalMinor: 5000000,
            dueAmountMinor: 1000000,
            amountPaidMinor: 4000000,
            taxMinor: 762712,
          },
          _avg: { totalMinor: 100000 },
        })
        // 5. gstAgg
        .mockResolvedValueOnce({
          _sum: { taxMinor: 762712 },
        });

      // 4. collected
      prismaMock.client.payment.aggregate.mockResolvedValueOnce({
        _sum: { amountMinor: 4000000 },
      });

      // 6. refundedAgg
      prismaMock.client.refund.aggregate.mockResolvedValueOnce({
        _sum: { amountMinor: 50000 },
      });

      // 8. txStatus
      prismaMock.client.paymentTransaction.groupBy.mockResolvedValueOnce([
        { status: PaymentTransactionStatus.CAPTURED, _count: { _all: 38 } },
        { status: PaymentTransactionStatus.FAILED, _count: { _all: 2 } },
      ]);

      // 9. pendingPayouts
      prismaMock.client.technicianCommission.aggregate.mockResolvedValueOnce({
        _sum: { netMinor: 850000 },
      });

      const result = await service.overview(tenantId, range);

      expect(result).toEqual({
        revenueMinor: 5000000,
        outstandingMinor: 1000000,
        collectedMinor: 4000000,
        refundedMinor: 50000,
        gstCollectedMinor: 762712,
        invoicesIssued: 50,
        invoicesPaid: 40,
        invoicesOverdue: 5,
        averageInvoiceMinor: 100000,
        paymentSuccessRate: 38 / 40,
        refundRatio: 50000 / 5000000,
        pendingPayoutsMinor: 850000,
        activeSubscriptions: 15,
        expiringIn14Days: 3,
      });

      // All fields should be numeric
      for (const value of Object.values(result)) {
        expect(typeof value).toBe('number');
        expect(Number.isNaN(value)).toBe(false);
      }
    });

    it('handles zero divisions and null aggregations gracefully', async () => {
      prismaMock.client.invoice.count
        .mockResolvedValueOnce(0) // totalIssued
        .mockResolvedValueOnce(0) // totalPaid
        .mockResolvedValueOnce(0); // overdue

      prismaMock.client.aMCSubscription.count
        .mockResolvedValueOnce(0) // activeSubs
        .mockResolvedValueOnce(0); // expiringSubs

      prismaMock.client.invoice.aggregate
        .mockResolvedValueOnce({
          _sum: { totalMinor: null, dueAmountMinor: null, amountPaidMinor: null, taxMinor: null },
          _avg: { totalMinor: null },
        })
        .mockResolvedValueOnce({
          _sum: { taxMinor: null },
        });

      prismaMock.client.payment.aggregate.mockResolvedValueOnce({
        _sum: { amountMinor: null },
      });

      prismaMock.client.refund.aggregate.mockResolvedValueOnce({
        _sum: { amountMinor: null },
      });

      prismaMock.client.paymentTransaction.groupBy.mockResolvedValueOnce([]);

      prismaMock.client.technicianCommission.aggregate.mockResolvedValueOnce({
        _sum: { netMinor: null },
      });

      const result = await service.overview(tenantId, range);

      expect(result).toEqual({
        revenueMinor: 0,
        outstandingMinor: 0,
        collectedMinor: 0,
        refundedMinor: 0,
        gstCollectedMinor: 0,
        invoicesIssued: 0,
        invoicesPaid: 0,
        invoicesOverdue: 0,
        averageInvoiceMinor: 0,
        paymentSuccessRate: 0,
        refundRatio: 0,
        pendingPayoutsMinor: 0,
        activeSubscriptions: 0,
        expiringIn14Days: 0,
      });
    });
  });

  describe('outstandingAging', () => {
    it('aggregates overdue amounts across the 4 age buckets', async () => {
      prismaMock.client.invoice.aggregate
        .mockResolvedValueOnce({ _sum: { dueAmountMinor: 100000 }, _count: 4 })
        .mockResolvedValueOnce({ _sum: { dueAmountMinor: 50000 }, _count: 2 })
        .mockResolvedValueOnce({ _sum: { dueAmountMinor: 20000 }, _count: 1 })
        .mockResolvedValueOnce({ _sum: { dueAmountMinor: 10000 }, _count: 1 });

      const buckets = await service.outstandingAging(tenantId);

      expect(buckets).toEqual([
        { bucket: '0–30', amountMinor: 100000, count: 4 },
        { bucket: '31–60', amountMinor: 50000, count: 2 },
        { bucket: '61–90', amountMinor: 20000, count: 1 },
        { bucket: '>90', amountMinor: 10000, count: 1 },
      ]);
    });
  });

  describe('payoutPipeline', () => {
    it('groups payouts by all known statuses with default 0s for missing', async () => {
      prismaMock.client.technicianPayout.groupBy.mockResolvedValueOnce([
        { status: PayoutStatus.APPROVED, _count: { _all: 3 }, _sum: { netMinor: 150000 } },
        { status: PayoutStatus.PAID, _count: { _all: 10 }, _sum: { netMinor: 600000 } },
      ]);

      const pipeline = await service.payoutPipeline(tenantId);

      expect(pipeline).toEqual([
        { status: PayoutStatus.PENDING, count: 0, totalMinor: 0 },
        { status: PayoutStatus.APPROVED, count: 3, totalMinor: 150000 },
        { status: PayoutStatus.PROCESSING, count: 0, totalMinor: 0 },
        { status: PayoutStatus.PAID, count: 10, totalMinor: 600000 },
        { status: PayoutStatus.FAILED, count: 0, totalMinor: 0 },
      ]);
    });
  });
});
