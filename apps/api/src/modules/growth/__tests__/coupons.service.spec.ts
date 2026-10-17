import { ConflictException, UnprocessableEntityException } from '@nestjs/common';

import { CouponsService } from '../coupons.service';

const baseCoupon = {
  id: 'cp_1',
  tenantId: 't1',
  code: 'WELCOME',
  discountType: 'FLAT',
  discountValue: 5_000,
  maxDiscountMinor: null,
  minOrderMinor: 0,
  validFrom: new Date('2020-01-01'),
  validUntil: null,
  usageLimit: 10,
  perCustomerLimit: 1,
  usedCount: 0,
  categories: [] as string[],
  firstBookingOnly: true,
  isActive: true,
  deletedAt: null,
};

function build(couponOverride: Partial<typeof baseCoupon> | null = {}) {
  const tx = {
    coupon: {
      findFirst: jest.fn().mockResolvedValue(couponOverride === null ? null : { ...baseCoupon, ...couponOverride }),
    },
    couponRedemption: {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'red_1', ...data })),
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
    },
    booking: { count: jest.fn().mockResolvedValue(0), findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    invoice: { findUnique: jest.fn() },
    $executeRaw: jest.fn().mockResolvedValue(1),
  };
  const prisma = {
    client: {
      ...tx,
      $transaction: jest.fn(async (arg: unknown) =>
        typeof arg === 'function' ? (arg as (t: typeof tx) => Promise<unknown>)(tx) : Promise.all(arg as Promise<unknown>[]),
      ),
    },
  };
  const invoices = { update: jest.fn().mockResolvedValue({}) };
  const service = new CouponsService(prisma as never, invoices as never);
  return { service, prisma, tx, invoices };
}

describe('CouponsService.validate', () => {
  it('returns invalid for unknown codes without throwing', async () => {
    const { service } = build(null);
    await expect(service.validate('t1', 'c1', 'nope')).resolves.toMatchObject({ valid: false, discountMinor: 0 });
  });

  it('normalises the code and excludes the priced booking from first-booking checks', async () => {
    const { service, tx } = build();
    const r = await service.validate('t1', 'c1', ' welcome ', { amountMinor: 20_000, bookingId: 'b1' });
    expect(r).toMatchObject({ valid: true, discountMinor: 5_000, couponId: 'cp_1' });
    expect(tx.coupon.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ code: 'WELCOME' }) }));
    expect(tx.booking.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ NOT: { id: 'b1' }, status: 'COMPLETED' }),
    });
  });

  it('rejects first-booking coupons for repeat customers', async () => {
    const { service, tx } = build();
    tx.booking.count.mockResolvedValue(2);
    await expect(service.validate('t1', 'c1', 'WELCOME')).resolves.toMatchObject({ valid: false });
  });
});

describe('CouponsService.redeem', () => {
  it('claims a usage slot atomically and writes the redemption', async () => {
    const { service, tx } = build();
    const row = await service.redeem('t1', 'c1', 'WELCOME', { bookingId: 'b1', amountMinor: 10_000 });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(row).toMatchObject({ couponId: 'cp_1', customerId: 'c1', bookingId: 'b1', discountMinor: 5_000 });
  });

  it('is idempotent per booking', async () => {
    const { service, tx } = build();
    tx.couponRedemption.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(service.redeem('t1', 'c1', 'WELCOME', { bookingId: 'b1' })).resolves.toEqual({ id: 'existing' });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('fails when the conditional increment loses the race', async () => {
    const { service, tx } = build();
    tx.$executeRaw.mockResolvedValue(0);
    await expect(service.redeem('t1', 'c1', 'WELCOME', {})).rejects.toBeInstanceOf(ConflictException);
    expect(tx.couponRedemption.create).not.toHaveBeenCalled();
  });

  it('rejects invalid coupons', async () => {
    const { service } = build({ isActive: false });
    await expect(service.redeem('t1', 'c1', 'WELCOME', {})).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});

describe('CouponsService.applyBookingCouponToInvoice', () => {
  const invoice = {
    id: 'inv_1',
    tenantId: 't1',
    customerId: 'c1',
    bookingId: 'b1',
    status: 'DRAFT',
    discountMinor: 0,
    totalMinor: 30_000,
  };

  it('applies the discount through InvoicesService and stamps the booking', async () => {
    const { service, tx, invoices } = build();
    tx.invoice.findUnique.mockResolvedValue(invoice);
    tx.booking.findUnique.mockResolvedValue({ id: 'b1', couponCode: 'WELCOME', category: 'AC_REPAIR' });
    await expect(service.applyBookingCouponToInvoice('inv_1')).resolves.toBe('applied');
    expect(invoices.update).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 't1' }), 'inv_1', {
      discountMinor: 5_000,
    });
    expect(tx.booking.update).toHaveBeenCalledWith({ where: { id: 'b1' }, data: { discountMinor: 5_000 } });
  });

  it('skips non-draft or already discounted invoices', async () => {
    const { service, tx, invoices } = build();
    tx.invoice.findUnique.mockResolvedValue({ ...invoice, status: 'SENT' });
    await expect(service.applyBookingCouponToInvoice('inv_1')).resolves.toBe('skipped');
    tx.invoice.findUnique.mockResolvedValue({ ...invoice, discountMinor: 100 });
    await expect(service.applyBookingCouponToInvoice('inv_1')).resolves.toBe('skipped');
    expect(invoices.update).not.toHaveBeenCalled();
  });

  it('releases the redemption when the invoice update fails', async () => {
    const { service, tx, invoices } = build();
    tx.invoice.findUnique.mockResolvedValue(invoice);
    tx.booking.findUnique.mockResolvedValue({ id: 'b1', couponCode: 'WELCOME', category: 'AC_REPAIR' });
    tx.couponRedemption.findUnique.mockResolvedValue({ id: 'red_1', couponId: 'cp_1', deletedAt: null });
    invoices.update.mockRejectedValue(new Error('boom'));
    await expect(service.applyBookingCouponToInvoice('inv_1')).resolves.toBe('skipped');
    expect(tx.couponRedemption.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'red_1' }, data: { deletedAt: expect.any(Date) } }),
    );
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2); // claim + release
  });
});
