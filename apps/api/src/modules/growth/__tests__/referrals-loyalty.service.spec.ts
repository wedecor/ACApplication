import {
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';

import type { GrowthConfig } from '../growth.config';
import { LoyaltyService } from '../loyalty.service';
import { maskName, ReferralsService } from '../referrals.service';

const config: GrowthConfig = {
  referralRewardMinor: 10_000,
  referralRewardPoints: 100,
  loyaltyPointsPer100: 1,
  reviewRequestDelayMinutes: 60,
  reviewRequestChannel: 'WHATSAPP',
  googleReviewUrl: null,
  schedulerDisabled: true,
};

function buildPrisma() {
  const client = {
    referralCode: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    referral: {
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    booking: { findUnique: jest.fn(), count: jest.fn().mockResolvedValue(0) },
    customer: { update: jest.fn(), findFirst: jest.fn() },
    loyaltyLedgerEntry: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'le_1', ...data })),
      findMany: jest.fn().mockResolvedValue([]),
    },
    invoice: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  client.$transaction.mockImplementation(async (fn: (tx: typeof client) => Promise<unknown>) => fn(client));
  return { client };
}

function build() {
  const prisma = buildPrisma();
  const loyalty = new LoyaltyService(prisma as never, config);
  const notifications = { enqueue: jest.fn().mockResolvedValue(['n1']) };
  const env = { WEB_URL: 'https://example.test/' };
  const referrals = new ReferralsService(prisma as never, loyalty, notifications as never, config, env as never);
  return { prisma: prisma.client, loyalty, referrals, notifications };
}

describe('LoyaltyService', () => {
  it('posts an entry with the running balance', async () => {
    const { prisma, loyalty } = build();
    prisma.customer.update.mockResolvedValue({ loyaltyPoints: 150 });
    const row = await loyalty.post({ tenantId: 't1', customerId: 'c1', points: 50, reason: 'x', refType: 'invoice', refId: 'i1' });
    expect(prisma.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { loyaltyPoints: { increment: 50 } } }),
    );
    expect(row).toMatchObject({ points: 50, balanceAfter: 150 });
  });

  it('is idempotent per reference', async () => {
    const { prisma, loyalty } = build();
    prisma.loyaltyLedgerEntry.findFirst.mockResolvedValue({ id: 'dup' });
    await expect(loyalty.post({ tenantId: 't1', customerId: 'c1', points: 5, reason: 'x', refType: 'invoice', refId: 'i1' })).resolves.toBeNull();
    expect(prisma.customer.update).not.toHaveBeenCalled();
  });

  it('rejects debits that would go negative', async () => {
    const { prisma, loyalty } = build();
    prisma.customer.update.mockResolvedValue({ loyaltyPoints: -10 });
    await expect(loyalty.post({ tenantId: 't1', customerId: 'c1', points: -20, reason: 'x' })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('accrues 1 point per ₹100 paid on an invoice', async () => {
    const { prisma, loyalty } = build();
    prisma.invoice.findUnique.mockResolvedValue({
      id: 'i1', tenantId: 't1', customerId: 'c1', number: 'INV-1', amountPaidMinor: 35_000, totalMinor: 35_000,
    });
    prisma.customer.update.mockResolvedValue({ loyaltyPoints: 3 });
    const row = await loyalty.accrueForInvoice('i1');
    expect(row).toMatchObject({ points: 3, refType: 'invoice', refId: 'i1' });
  });
});

describe('ReferralsService.apply', () => {
  it('creates a pending referral with the configured reward', async () => {
    const { prisma, referrals } = build();
    prisma.referralCode.findFirst.mockResolvedValue({ id: 'rc1', customerId: 'referrer' });
    prisma.referral.findUnique.mockResolvedValue(null);
    await expect(referrals.apply('t1', 'newbie', 'abcd2345')).resolves.toEqual({ ok: true });
    expect(prisma.referralCode.findFirst).toHaveBeenCalledWith({ where: { tenantId: 't1', code: 'ABCD2345', deletedAt: null } });
    expect(prisma.referral.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ referrerCustomerId: 'referrer', referredCustomerId: 'newbie', rewardMinor: 10_000 }),
    });
  });

  it('blocks self-referral', async () => {
    const { prisma, referrals } = build();
    prisma.referralCode.findFirst.mockResolvedValue({ id: 'rc1', customerId: 'me' });
    await expect(referrals.apply('t1', 'me', 'CODE1234')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks customers with completed bookings', async () => {
    const { prisma, referrals } = build();
    prisma.referralCode.findFirst.mockResolvedValue({ id: 'rc1', customerId: 'referrer' });
    prisma.booking.count.mockResolvedValue(1);
    prisma.referral.findUnique.mockResolvedValue(null);
    await expect(referrals.apply('t1', 'old', 'CODE1234')).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('blocks a second referral', async () => {
    const { prisma, referrals } = build();
    prisma.referralCode.findFirst.mockResolvedValue({ id: 'rc1', customerId: 'referrer' });
    prisma.referral.findUnique.mockResolvedValue({ id: 'r0' });
    await expect(referrals.apply('t1', 'newbie', 'CODE1234')).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('ReferralsService.onBookingCompleted', () => {
  it("rewards the referrer on the referred customer's first completed booking", async () => {
    const { prisma, referrals, notifications } = build();
    prisma.booking.findUnique.mockResolvedValue({ id: 'b1', tenantId: 't1', customerId: 'newbie', status: 'COMPLETED' });
    prisma.referral.findUnique
      .mockResolvedValueOnce({ id: 'r1', status: 'PENDING', deletedAt: null })
      .mockResolvedValueOnce({ id: 'r1', status: 'QUALIFIED', tenantId: 't1', referrerCustomerId: 'referrer' });
    prisma.booking.count.mockResolvedValue(1);
    prisma.customer.update.mockResolvedValue({ loyaltyPoints: 100 });
    prisma.referral.update.mockResolvedValue({
      id: 'r1', tenantId: 't1', rewardMinor: 10_000, referrer: { userId: 'u1', phone: '+911', email: null },
    });

    await expect(referrals.onBookingCompleted('b1')).resolves.toBe('rewarded');
    expect(prisma.referral.updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', status: 'PENDING' },
      data: expect.objectContaining({ status: 'QUALIFIED', qualifiedBookingId: 'b1' }),
    });
    expect(prisma.loyaltyLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ customerId: 'referrer', points: 100, refType: 'referral', refId: 'r1' }),
    });
    expect(prisma.referral.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'REWARDED' }) }),
    );
    expect(notifications.enqueue).toHaveBeenCalled();
  });

  it('skips when it is not the first completed booking', async () => {
    const { prisma, referrals } = build();
    prisma.booking.findUnique.mockResolvedValue({ id: 'b2', tenantId: 't1', customerId: 'newbie', status: 'COMPLETED' });
    prisma.referral.findUnique.mockResolvedValue({ id: 'r1', status: 'PENDING', deletedAt: null });
    prisma.booking.count.mockResolvedValue(2);
    await expect(referrals.onBookingCompleted('b2')).resolves.toBe('skipped');
    expect(prisma.referral.updateMany).not.toHaveBeenCalled();
  });
});

describe('ReferralsService.summaryForCustomer', () => {
  it('lazily creates a code and masks referred names', async () => {
    const { prisma, referrals } = build();
    prisma.referralCode.findUnique.mockResolvedValue(null);
    prisma.referralCode.create.mockImplementation(({ data }) => Promise.resolve({ id: 'rc', ...data, deletedAt: null }));
    prisma.referral.findMany.mockResolvedValue([
      { id: 'r1', status: 'REWARDED', rewardMinor: 10_000, createdAt: new Date('2026-01-01'), referred: { fullName: 'Priya Sharma' } },
      { id: 'r2', status: 'PENDING', rewardMinor: 10_000, createdAt: new Date('2026-01-02'), referred: { fullName: 'Ravi' } },
    ]);
    const s = await referrals.summaryForCustomer('t1', 'c1');
    expect(s.code).toMatch(/^[A-Z2-9]{8}$/);
    expect(s.shareUrl).toBe(`https://example.test/r/${s.code}`);
    expect(s).toMatchObject({ referredCount: 2, rewardedCount: 1, totalRewardMinor: 10_000 });
    expect(s.referrals.map((r) => r.referredName)).toEqual(['Priya S.', 'Ravi']);
  });
});

describe('maskName', () => {
  it('keeps first name and last initial', () => {
    expect(maskName('  a b c ')).toBe('a C.');
    expect(maskName('')).toBe('Friend');
  });
});
