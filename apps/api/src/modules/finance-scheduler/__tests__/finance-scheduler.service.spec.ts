import { DomainEventName, InvoiceStatus, PayoutCycle } from '@ac/types';

import { FinanceSchedulerService } from '../finance-scheduler.service';

describe('FinanceSchedulerService', () => {
  const originalEnv = process.env.FINANCE_SCHEDULER_DISABLED;

  let prismaMock: {
    client: {
      invoice: {
        findMany: jest.Mock;
        update: jest.Mock;
      };
      technicianCommissionRule: {
        findMany: jest.Mock;
      };
    };
  };
  let eventsMock: {
    publish: jest.Mock;
  };
  let amcMock: {
    materialiseImminentVisits: jest.Mock;
    runRenewalSweep: jest.Mock;
    runMissedVisitSweep: jest.Mock;
  };
  let quotationsMock: {
    expireOverdue: jest.Mock;
  };
  let payoutsMock: {
    createPayout: jest.Mock;
  };

  beforeEach(() => {
    delete process.env.FINANCE_SCHEDULER_DISABLED;

    prismaMock = {
      client: {
        invoice: {
          findMany: jest.fn().mockResolvedValue([]),
          update: jest.fn().mockResolvedValue({}),
        },
        technicianCommissionRule: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    };
    eventsMock = {
      publish: jest.fn(),
    };
    amcMock = {
      materialiseImminentVisits: jest.fn().mockResolvedValue(undefined),
      runRenewalSweep: jest.fn().mockResolvedValue({ reminders: 2, renewals: 1 }),
      runMissedVisitSweep: jest.fn().mockResolvedValue(0),
    };
    quotationsMock = {
      expireOverdue: jest.fn().mockResolvedValue(0),
    };
    payoutsMock = {
      createPayout: jest.fn().mockResolvedValue({ id: 'payout_1' }),
    };
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.FINANCE_SCHEDULER_DISABLED = originalEnv;
    } else {
      delete process.env.FINANCE_SCHEDULER_DISABLED;
    }
    jest.clearAllMocks();
  });

  function createService(): FinanceSchedulerService {
    return new FinanceSchedulerService(
      prismaMock as never,
      eventsMock as never,
      amcMock as never,
      quotationsMock as never,
      payoutsMock as never,
    );
  }

  describe('when FINANCE_SCHEDULER_DISABLED=1', () => {
    it('expireQuotations() returns without calling quotations.expireOverdue', async () => {
      process.env.FINANCE_SCHEDULER_DISABLED = '1';
      const svc = createService();

      await svc.expireQuotations();

      expect(quotationsMock.expireOverdue).not.toHaveBeenCalled();
    });

    it('overdueInvoices() returns without querying invoices', async () => {
      process.env.FINANCE_SCHEDULER_DISABLED = '1';
      const svc = createService();

      await svc.overdueInvoices();

      expect(prismaMock.client.invoice.findMany).not.toHaveBeenCalled();
    });
  });

  describe('expireQuotations', () => {
    it('calls quotations.expireOverdue and logs count when positive', async () => {
      quotationsMock.expireOverdue.mockResolvedValue(5);
      const svc = createService();

      await svc.expireQuotations();

      expect(quotationsMock.expireOverdue).toHaveBeenCalledTimes(1);
    });

    it('handles errors gracefully without re-throwing', async () => {
      quotationsMock.expireOverdue.mockRejectedValue(new Error('DB connection failure'));
      const svc = createService();

      await expect(svc.expireQuotations()).resolves.toBeUndefined();
    });
  });

  describe('overdueInvoices', () => {
    it('queries overdue invoices, updates status to OVERDUE and publishes InvoiceOverdue event', async () => {
      const pastDueDate = new Date('2026-10-01T00:00:00.000Z');
      prismaMock.client.invoice.findMany.mockResolvedValue([
        {
          id: 'inv_overdue_1',
          tenantId: 'tenant_1',
          customerId: 'cust_1',
          dueAmountMinor: 45000,
          dueDate: pastDueDate,
        },
      ]);
      const svc = createService();

      await svc.overdueInvoices();

      expect(prismaMock.client.invoice.findMany).toHaveBeenCalledWith({
        where: {
          dueDate: { lt: expect.any(Date) },
          dueAmountMinor: { gt: 0 },
          status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID] },
        },
        select: {
          id: true,
          tenantId: true,
          customerId: true,
          dueAmountMinor: true,
          dueDate: true,
        },
        take: 500,
      });

      expect(prismaMock.client.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv_overdue_1' },
        data: { status: InvoiceStatus.OVERDUE },
      });

      expect(eventsMock.publish).toHaveBeenCalledWith(
        DomainEventName.InvoiceOverdue,
        expect.objectContaining({
          invoiceId: 'inv_overdue_1',
          customerId: 'cust_1',
          dueAmountMinor: 45000,
          daysOverdue: expect.any(Number),
        }),
      );
    });

    it('does nothing when no invoices are overdue', async () => {
      prismaMock.client.invoice.findMany.mockResolvedValue([]);
      const svc = createService();

      await svc.overdueInvoices();

      expect(prismaMock.client.invoice.update).not.toHaveBeenCalled();
      expect(eventsMock.publish).not.toHaveBeenCalled();
    });
  });

  describe('materialiseAmcVisits', () => {
    it('delegates to amc.materialiseImminentVisits', async () => {
      const svc = createService();
      await svc.materialiseAmcVisits();
      expect(amcMock.materialiseImminentVisits).toHaveBeenCalledTimes(1);
    });

    it('swallows errors when amc service throws', async () => {
      amcMock.materialiseImminentVisits.mockRejectedValue(new Error('AMC visit generation failure'));
      const svc = createService();
      await expect(svc.materialiseAmcVisits()).resolves.toBeUndefined();
    });
  });

  describe('amcRenewalSweep', () => {
    it('delegates to amc.runRenewalSweep', async () => {
      const svc = createService();
      await svc.amcRenewalSweep();
      expect(amcMock.runRenewalSweep).toHaveBeenCalledTimes(1);
    });

    it('swallows errors when amc service throws', async () => {
      amcMock.runRenewalSweep.mockRejectedValue(new Error('Renewal error'));
      const svc = createService();
      await expect(svc.amcRenewalSweep()).resolves.toBeUndefined();
    });
  });

  describe('amcMissedVisitSweep', () => {
    it('delegates to amc.runMissedVisitSweep', async () => {
      amcMock.runMissedVisitSweep.mockResolvedValue(3);
      const svc = createService();
      await svc.amcMissedVisitSweep();
      expect(amcMock.runMissedVisitSweep).toHaveBeenCalledTimes(1);
    });

    it('swallows errors when amc service throws', async () => {
      amcMock.runMissedVisitSweep.mockRejectedValue(new Error('Missed visit error'));
      const svc = createService();
      await expect(svc.amcMissedVisitSweep()).resolves.toBeUndefined();
    });
  });

  describe('weeklyPayoutClose', () => {
    it('queries WEEKLY commission rules and calls createPayout for each', async () => {
      prismaMock.client.technicianCommissionRule.findMany.mockResolvedValue([
        {
          technicianId: 'tech_1',
          payoutCycle: PayoutCycle.WEEKLY,
          technician: { id: 'tech_1', tenantId: 'tenant_1' },
        },
      ]);
      const svc = createService();

      await svc.weeklyPayoutClose();

      expect(prismaMock.client.technicianCommissionRule.findMany).toHaveBeenCalledWith({
        where: { payoutCycle: PayoutCycle.WEEKLY },
        include: { technician: { select: { id: true, tenantId: true } } },
      });
      expect(payoutsMock.createPayout).toHaveBeenCalledWith(
        { userId: 'cron', tenantId: 'tenant_1' },
        { technicianId: 'tech_1' },
      );
    });

    it('ignores individual technician payout failures silently', async () => {
      prismaMock.client.technicianCommissionRule.findMany.mockResolvedValue([
        {
          technicianId: 'tech_1',
          payoutCycle: PayoutCycle.WEEKLY,
          technician: { id: 'tech_1', tenantId: 'tenant_1' },
        },
      ]);
      payoutsMock.createPayout.mockRejectedValue(new Error('No accrued commissions'));
      const svc = createService();

      await expect(svc.weeklyPayoutClose()).resolves.toBeUndefined();
    });
  });
});
