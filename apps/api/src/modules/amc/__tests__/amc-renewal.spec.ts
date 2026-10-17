import { AMCSubscriptionStatus } from '@ac/types';

import { AmcSubscriptionsService } from '../amc-subscriptions.service';

const PLAN = { durationMonths: 12, includedVisits: 2, visitCadenceDays: 180 };

function build(sub: Record<string, unknown> | null, firstInvoiceId = 'inv_first') {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    aMCSubscription: { findUnique: jest.fn().mockResolvedValue(sub), update: jest.fn() },
    invoice: { findFirst: jest.fn().mockResolvedValue({ id: firstInvoiceId }) },
    aMCVisit: { createMany: jest.fn() },
  };
  const prisma = {
    client: {
      aMCSubscription: { findUnique: jest.fn().mockResolvedValue(sub), update: jest.fn() },
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    },
  };
  const events = { publish: jest.fn() };
  const svc = new AmcSubscriptionsService(prisma as never, events as never, {} as never, {} as never);
  return { svc, tx, events };
}

function activeSub(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_1',
    tenantId: 't1',
    customerId: 'c1',
    status: AMCSubscriptionStatus.ACTIVE,
    endsAt: new Date('2026-12-01T00:00:00Z'),
    metadata: {},
    plan: PLAN,
    visits: [{ visitNumber: 1 }, { visitNumber: 2 }],
    ...overrides,
  };
}

describe('AmcSubscriptionsService renewal', () => {
  const now = new Date('2026-11-25T00:00:00Z');

  it('extends an active term from its current end and schedules the next visits', async () => {
    const { svc, tx, events } = build(activeSub());
    await svc.applyRenewal('sub_1', 'inv_renew', now);

    const data = tx.aMCSubscription.update.mock.calls[0][0].data;
    expect(data.endsAt.toISOString()).toBe('2027-12-01T00:00:00.000Z');
    expect(data.status).toBe(AMCSubscriptionStatus.ACTIVE);
    expect(data.metadata.renewedInvoiceIds).toEqual(['inv_renew']);
    const visits = tx.aMCVisit.createMany.mock.calls[0][0].data;
    expect(visits.map((v: { visitNumber: number }) => v.visitNumber)).toEqual([3, 4]);
    expect(events.publish).toHaveBeenCalledTimes(1);
  });

  it('extends an expired term from now, not from the old end date', async () => {
    const { svc, tx } = build(
      activeSub({ status: AMCSubscriptionStatus.EXPIRED, endsAt: new Date('2026-01-01T00:00:00Z') }),
    );
    await svc.applyRenewal('sub_1', 'inv_renew', now);
    const data = tx.aMCSubscription.update.mock.calls[0][0].data;
    expect(data.endsAt.toISOString()).toBe('2027-11-25T00:00:00.000Z');
  });

  it('is idempotent per invoice', async () => {
    const { svc, tx, events } = build(activeSub({ metadata: { renewedInvoiceIds: ['inv_renew'] } }));
    await svc.applyRenewal('sub_1', 'inv_renew', now);
    expect(tx.aMCSubscription.update).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('ignores the original activation invoice', async () => {
    const { svc, tx } = build(activeSub(), 'inv_renew');
    await svc.applyRenewal('sub_1', 'inv_renew', now);
    expect(tx.aMCSubscription.update).not.toHaveBeenCalled();
  });

  it('routes paid invoices on active subscriptions to renewal', async () => {
    const { svc } = build(activeSub());
    const spy = jest.spyOn(svc, 'applyRenewal').mockResolvedValue(undefined);
    await svc.onSubscriptionInvoicePaid('sub_1', 'inv_renew');
    expect(spy).toHaveBeenCalledWith('sub_1', 'inv_renew');
  });
});
