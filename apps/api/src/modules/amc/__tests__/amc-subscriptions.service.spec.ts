import { AMCSubscriptionStatus, AMCVisitStatus, BookingStatus } from '@ac/types';

import { AmcSubscriptionsService } from '../amc-subscriptions.service';

function buildSvc() {
  const prisma = {
    client: {
      aMCSubscription: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      aMCVisit: {
        findMany: jest.fn(),
        update: jest.fn(),
        createMany: jest.fn(),
        updateMany: jest.fn(),
      },
      booking: { create: jest.fn() },
      invoice: { findFirst: jest.fn(), create: jest.fn() },
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
  } as never;
  const events = { publish: jest.fn(), emit: jest.fn() };
  const invoices = {} as never;
  const pdf = {} as never;
  const svc = new AmcSubscriptionsService(prisma, events as never, invoices, pdf);
  return { svc, prisma: prisma as { client: Record<string, { findUnique: jest.Mock; update: jest.Mock; findMany: jest.Mock; updateMany?: jest.Mock; create: jest.Mock; createMany: jest.Mock; findFirst: jest.Mock }> }, events };
}

describe('AmcSubscriptionsService', () => {
  describe('runMissedVisitSweep', () => {
    it('flips stale SCHEDULED visits to MISSED', async () => {
      const { svc, prisma, events } = buildSvc();
      const now = new Date('2025-06-10T00:00:00Z');
      prisma.client.aMCVisit.findMany.mockResolvedValue([
        { id: 'v1', tenantId: 't', subscriptionId: 's', scheduledFor: new Date('2025-06-01T00:00:00Z') },
        { id: 'v2', tenantId: 't', subscriptionId: 's', scheduledFor: new Date('2025-06-02T00:00:00Z') },
      ]);
      prisma.client.aMCVisit.update.mockResolvedValue({});

      const flagged = await svc.runMissedVisitSweep(now);
      expect(flagged).toBe(2);
      expect(prisma.client.aMCVisit.update).toHaveBeenCalledTimes(2);
      expect(prisma.client.aMCVisit.update).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: { status: AMCVisitStatus.MISSED, missedAt: now },
      });
      expect(events.publish).toHaveBeenCalledTimes(2);
    });

    it('ignores visits within the 48 h grace window', async () => {
      const { svc, prisma } = buildSvc();
      prisma.client.aMCVisit.findMany.mockResolvedValue([]);
      const flagged = await svc.runMissedVisitSweep(new Date('2025-06-10T00:00:00Z'));
      expect(flagged).toBe(0);
      expect(prisma.client.aMCVisit.update).not.toHaveBeenCalled();
    });
  });

  describe('runRenewalSweep', () => {
    it('emits expiry reminders 14/7/1 days before endsAt', async () => {
      const { svc, prisma, events } = buildSvc();
      const now = new Date('2025-06-01T00:00:00Z');
      prisma.client.aMCSubscription.findMany
        // 14d
        .mockResolvedValueOnce([{ id: 's1', tenantId: 't', customerId: 'c1' }])
        // 7d
        .mockResolvedValueOnce([{ id: 's2', tenantId: 't', customerId: 'c2' }])
        // 1d
        .mockResolvedValueOnce([{ id: 's3', tenantId: 't', customerId: 'c3' }])
        // renewable
        .mockResolvedValueOnce([]);
      prisma.client.aMCSubscription.updateMany = jest.fn().mockResolvedValue({ count: 0 });

      const r = await svc.runRenewalSweep(now);
      expect(r.reminders).toBe(3);
      expect(r.renewals).toBe(0);
      expect(events.publish).toHaveBeenCalledTimes(3);
    });

    it('expires subscriptions whose endsAt is in the past', async () => {
      const { svc, prisma } = buildSvc();
      prisma.client.aMCSubscription.findMany.mockResolvedValue([]);
      const update = jest.fn().mockResolvedValue({ count: 5 });
      prisma.client.aMCSubscription.updateMany = update;
      await svc.runRenewalSweep(new Date());
      expect(update).toHaveBeenCalledWith({
        where: { status: AMCSubscriptionStatus.ACTIVE, endsAt: { lt: expect.any(Date) } },
        data: { status: AMCSubscriptionStatus.EXPIRED },
      });
    });
  });

  describe('materialiseImminentVisits', () => {
    it('skips visits when the customer lacks an address or city', async () => {
      const { svc, prisma } = buildSvc();
      prisma.client.aMCVisit.findMany.mockResolvedValue([
        {
          id: 'v1',
          tenantId: 't',
          subscription: {
            plan: { appliancesCovered: ['SPLIT_AC'] },
            customer: { id: 'cust', defaultAddressId: null, tenantId: 't', cityId: null },
            number: 'AMC-1',
          },
          visitNumber: 1,
          scheduledFor: new Date(),
        },
      ]);
      const count = await svc.materialiseImminentVisits();
      expect(count).toBe(0);
      expect(prisma.client.booking.create).not.toHaveBeenCalled();
    });

    it('creates one booking per ready visit', async () => {
      const { svc, prisma } = buildSvc();
      const scheduledFor = new Date('2025-06-10T10:00:00Z');
      prisma.client.aMCVisit.findMany.mockResolvedValue([
        {
          id: 'v1',
          tenantId: 't',
          visitNumber: 1,
          scheduledFor,
          subscription: {
            number: 'AMC-1',
            plan: { appliancesCovered: ['SPLIT_AC'] },
            customer: { id: 'cust', defaultAddressId: 'addr', tenantId: 't', cityId: 'city' },
          },
        },
      ]);
      prisma.client.booking.create.mockResolvedValue({ id: 'book_new' });
      prisma.client.aMCVisit.update.mockResolvedValue({});

      const count = await svc.materialiseImminentVisits();
      expect(count).toBe(1);
      expect(prisma.client.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerId: 'cust',
            addressId: 'addr',
            cityId: 'city',
            status: BookingStatus.PENDING,
            scheduledAt: scheduledFor,
          }),
        }),
      );
    });
  });
});
