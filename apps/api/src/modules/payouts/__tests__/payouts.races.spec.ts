import { CommissionStatus, PayoutStatus } from '@ac/types';
import { ConflictException, NotFoundException } from '@nestjs/common';

import { PayoutsService } from '../payouts.service';

const actor = { tenantId: 't1', userId: 'u1' } as never;

function build() {
  const tx = {
    technicianPayout: { create: jest.fn().mockResolvedValue({ id: 'po_1', technicianId: 'tech_1', netMinor: 900 }) },
    technicianCommission: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
  };
  const client = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    technician: { findFirst: jest.fn().mockResolvedValue({ id: 'tech_1' }) },
    technicianCommission: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'c1', baseMinor: 500, bonusMinor: 0, penaltyMinor: 0, adjustmentMinor: 0, netMinor: 500, status: CommissionStatus.ACCRUED },
        { id: 'c2', baseMinor: 400, bonusMinor: 0, penaltyMinor: 0, adjustmentMinor: 0, netMinor: 400, status: CommissionStatus.ACCRUED },
      ]),
    },
    technicianPayout: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'po_1' }) },
  };
  const events = { publish: jest.fn() };
  const svc = new PayoutsService({ client } as never, events as never);
  return { svc, tx, client, events };
}

const dto = { technicianId: 'tech_1', periodStart: '2026-10-01', periodEnd: '2026-10-08' } as never;

describe('PayoutsService races', () => {
  it('claims only unsettled commissions and publishes after commit', async () => {
    const { svc, tx, events } = build();
    await svc.createPayout(actor, dto);
    expect(tx.technicianCommission.updateMany.mock.calls[0][0].where).toEqual({ id: { in: ['c1', 'c2'] }, payoutId: null });
    expect(events.publish).toHaveBeenCalledTimes(1);
  });

  it('rolls back when another run already took some commissions (no double payout)', async () => {
    const { svc, tx, events } = build();
    tx.technicianCommission.updateMany.mockResolvedValueOnce({ count: 1 });
    await expect(svc.createPayout(actor, dto)).rejects.toBeInstanceOf(ConflictException);
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('fails a payout only inside the tenant and before it is paid', async () => {
    const { svc, client } = build();
    await svc.fail(actor, 'po_1', 'bank rejected');
    expect(client.technicianPayout.updateMany.mock.calls[0][0].where).toEqual({
      id: 'po_1',
      tenantId: 't1',
      status: { in: [PayoutStatus.PENDING, PayoutStatus.APPROVED, PayoutStatus.PROCESSING] },
    });
    client.technicianPayout.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(svc.fail(actor, 'other_tenant_po', 'x')).rejects.toBeInstanceOf(NotFoundException);
  });
});
