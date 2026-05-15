import { BookingStatus, CommissionStatus, CommissionType, DomainEventName } from '@ac/types';

import { PayoutsService } from '../payouts.service';

type PrismaMock = {
  client: {
    booking: { findUnique: jest.Mock };
    technicianCommissionRule: { findUnique: jest.Mock };
    technicianCommission: { create: jest.Mock; aggregate: jest.Mock };
  };
};

const baseRule = {
  type: CommissionType.PERCENTAGE,
  valueMinor: 4000, // 40%
  bonusMinor: 0,
  penaltyPerLateMinuteMinor: 0,
};

function buildService() {
  const prisma: PrismaMock = {
    client: {
      booking: { findUnique: jest.fn() },
      technicianCommissionRule: { findUnique: jest.fn() },
      technicianCommission: {
        create: jest.fn().mockResolvedValue({ id: 'comm_1' }),
        aggregate: jest.fn(),
      },
    },
  };
  const events = { publish: jest.fn(), emit: jest.fn() };
  const svc = new PayoutsService(prisma as never, events as never);
  return { svc, prisma, events };
}

describe('PayoutsService.accrueForBooking', () => {
  it('does nothing if the booking is not COMPLETED', async () => {
    const { svc, prisma } = buildService();
    prisma.client.booking.findUnique.mockResolvedValue({
      status: BookingStatus.PENDING,
      technicianId: 'tech_1',
      commission: null,
    });
    await svc.accrueForBooking('book_1');
    expect(prisma.client.technicianCommission.create).not.toHaveBeenCalled();
  });

  it('does nothing if there is already a commission row (idempotent)', async () => {
    const { svc, prisma } = buildService();
    prisma.client.booking.findUnique.mockResolvedValue({
      status: BookingStatus.COMPLETED,
      technicianId: 'tech_1',
      finalAmountMinor: 100_000,
      commission: { id: 'comm_existing' },
      tenantId: 'tenant_1',
    });
    await svc.accrueForBooking('book_1');
    expect(prisma.client.technicianCommission.create).not.toHaveBeenCalled();
  });

  it('computes a PERCENTAGE commission against finalAmountMinor', async () => {
    const { svc, prisma } = buildService();
    prisma.client.booking.findUnique.mockResolvedValue({
      id: 'book_1',
      tenantId: 'tenant_1',
      technicianId: 'tech_1',
      status: BookingStatus.COMPLETED,
      finalAmountMinor: 200_000,
      estimatedAmountMinor: null,
      commission: null,
    });
    prisma.client.technicianCommissionRule.findUnique.mockResolvedValue({
      ...baseRule,
      bonusMinor: 500,
    });
    await svc.accrueForBooking('book_1');
    expect(prisma.client.technicianCommission.create).toHaveBeenCalledTimes(1);
    const args = prisma.client.technicianCommission.create.mock.calls[0][0];
    expect(args.data.baseMinor).toBe(80_000); // 40% of 200_000
    expect(args.data.bonusMinor).toBe(500);
    expect(args.data.netMinor).toBe(80_500);
    expect(args.data.status).toBe(CommissionStatus.ACCRUED);
  });

  it('falls back to a default rule when none configured', async () => {
    const { svc, prisma } = buildService();
    prisma.client.booking.findUnique.mockResolvedValue({
      id: 'book_x',
      tenantId: 'tenant_1',
      technicianId: 'tech_x',
      status: BookingStatus.COMPLETED,
      finalAmountMinor: 100_000,
      commission: null,
    });
    prisma.client.technicianCommissionRule.findUnique.mockResolvedValue(null);
    await svc.accrueForBooking('book_x');
    const args = prisma.client.technicianCommission.create.mock.calls[0][0];
    expect(args.data.baseMinor).toBe(40_000); // 40% default
  });

  it('handles FLAT type rules', async () => {
    const { svc, prisma } = buildService();
    prisma.client.booking.findUnique.mockResolvedValue({
      id: 'book_flat',
      tenantId: 'tenant_1',
      technicianId: 'tech_flat',
      status: BookingStatus.COMPLETED,
      finalAmountMinor: 999_999,
      commission: null,
    });
    prisma.client.technicianCommissionRule.findUnique.mockResolvedValue({
      type: CommissionType.FLAT,
      valueMinor: 20_000,
      bonusMinor: 0,
      penaltyPerLateMinuteMinor: 0,
    });
    await svc.accrueForBooking('book_flat');
    const args = prisma.client.technicianCommission.create.mock.calls[0][0];
    expect(args.data.baseMinor).toBe(20_000);
    expect(args.data.netMinor).toBe(20_000);
  });
});
