import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { CustomersService, normalizeTags, splitFullName } from '../customers.service';

const actor = {
  userId: 'user_1',
  tenantId: 'tenant_1',
  sessionId: 's',
  roles: [],
  permissions: [],
  email: null,
  phone: null,
  permissionVersion: 1,
  iat: 0,
  exp: 0,
} as never;

const MOVED_MODELS = [
  'address',
  'booking',
  'invoice',
  'paymentTransaction',
  'refund',
  'creditNote',
  'customerLedgerEntry',
  'quotation',
  'aMCSubscription',
  'supportTicket',
  'conversation',
  'callLog',
  'customerAppliance',
  'warrantyClaim',
  'bookingRating',
  'savedPaymentMethod',
  'couponRedemption',
  'loyaltyLedgerEntry',
  'opportunity',
] as const;

function customerRow(over: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    tenantId: 'tenant_1',
    userId: 'u1',
    cityId: null,
    accountId: null,
    fullName: 'Priya',
    email: null,
    phone: '+919876543210',
    tags: [],
    customFields: {},
    preferences: {},
    preferredLanguage: 'en',
    loyaltyPoints: 0,
    mergedIntoId: null,
    defaultAddressId: null,
    lifetimeValueMinor: 0n,
    totalBookings: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    city: null,
    account: null,
    _count: { bookings: 0, invoices: 0 },
    ...over,
  };
}

function buildTx() {
  const tx: Record<string, Record<string, jest.Mock>> = {};
  for (const m of MOVED_MODELS) tx[m] = { updateMany: jest.fn().mockResolvedValue({ count: 1 }) };
  tx.task = { updateMany: jest.fn().mockResolvedValue({ count: 0 }) };
  tx.referral = {
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    findUnique: jest.fn().mockResolvedValue(null),
    update: jest.fn(),
  };
  tx.referralCode = { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() };
  tx.customer = { findFirst: jest.fn(), update: jest.fn() };
  tx.booking!.count = jest.fn().mockResolvedValue(3);
  tx.invoice!.aggregate = jest
    .fn()
    .mockResolvedValue({ _sum: { amountPaidMinor: 50_000, amountRefundedMinor: 0 } });
  tx.user = { create: jest.fn().mockResolvedValue({ id: 'u_new' }) };
  tx.role = { findFirst: jest.fn().mockResolvedValue({ id: 'role_c' }) };
  tx.userRoleAssignment = { create: jest.fn() };
  return tx;
}

function build() {
  const tx = buildTx();
  tx.customer!.create = jest.fn().mockResolvedValue({ id: 'c_new' });
  const prisma = {
    client: {
      $transaction: jest.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
      customer: { findFirst: jest.fn().mockResolvedValue(null) },
      account: { findFirst: jest.fn().mockResolvedValue({ id: 'acc_1' }) },
      city: { findFirst: jest.fn().mockResolvedValue({ id: 'city_1' }) },
    },
  };
  const repo = { findById: jest.fn().mockResolvedValue(customerRow({ id: 'c_new' })), list: jest.fn() };
  const customFields = { validateCustomFields: jest.fn(async (_t, _e, v) => v ?? {}) };
  const service = new CustomersService(repo as never, prisma as never, customFields as never);
  return { service, prisma, repo, tx, customFields };
}

describe('helpers', () => {
  it('normalizeTags trims, lower-cases and de-dupes', () => {
    expect(normalizeTags([' VIP ', 'vip', '', 'Society'])).toEqual(['vip', 'society']);
  });
  it('splitFullName', () => {
    expect(splitFullName('Priya  K Sharma')).toEqual({ firstName: 'Priya', lastName: 'K Sharma' });
    expect(splitFullName('Priya')).toEqual({ firstName: 'Priya', lastName: null });
  });
});

describe('CustomersService.createForTenant', () => {
  it('creates user + role + customer with normalised phone', async () => {
    const { service, tx } = build();
    await service.createForTenant('tenant_1', 'user_1', {
      fullName: 'Priya Sharma',
      phone: '98765 43210',
      tags: ['VIP'],
    });
    expect(tx.user!.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phone: '+919876543210', firstName: 'Priya', lastName: 'Sharma' }),
      }),
    );
    expect(tx.userRoleAssignment!.create).toHaveBeenCalled();
    expect(tx.customer!.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tags: ['vip'] }) }),
    );
  });

  it('rejects invalid phones', async () => {
    const { service } = build();
    await expect(
      service.createForTenant('tenant_1', null, { fullName: 'X', phone: '123' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('409s when a customer with the phone exists', async () => {
    const { service, prisma } = build();
    prisma.client.customer.findFirst.mockResolvedValue({ id: 'c_old' });
    await expect(
      service.createForTenant('tenant_1', null, { fullName: 'X', phone: '9876543210' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('validates the account', async () => {
    const { service, prisma } = build();
    prisma.client.account.findFirst.mockResolvedValue(null);
    await expect(
      service.createForTenant('tenant_1', null, {
        fullName: 'X',
        phone: '9876543210',
        accountId: 'nope',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('CustomersService.merge', () => {
  it('rejects self-merge', async () => {
    const { service } = build();
    await expect(service.merge(actor, 'c1', 'c1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404s when either side is missing', async () => {
    const { service, tx } = build();
    tx.customer!.findFirst!.mockResolvedValueOnce(customerRow()).mockResolvedValueOnce(null);
    await expect(service.merge(actor, 'c1', 'c2')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses to merge into a merged customer', async () => {
    const { service, tx } = build();
    tx.customer!.findFirst!
      .mockResolvedValueOnce(customerRow())
      .mockResolvedValueOnce(customerRow({ id: 'c2', mergedIntoId: 'c3' }));
    await expect(service.merge(actor, 'c1', 'c2')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('moves every customer-owned table and stamps the duplicate', async () => {
    const { service, tx, repo } = build();
    tx.customer!.findFirst!
      .mockResolvedValueOnce(
        customerRow({
          id: 'dup',
          tags: ['a'],
          email: 'd@x.com',
          loyaltyPoints: 30,
          defaultAddressId: 'addr_dup',
          lifetimeValueMinor: 10_000n,
          customFields: { gate: '1', floor: '2' },
        }),
      )
      .mockResolvedValueOnce(
        customerRow({ id: 'surv', tags: ['b'], loyaltyPoints: 5, customFields: { gate: '9' } }),
      );
    repo.findById.mockResolvedValue(customerRow({ id: 'surv' }));

    await service.merge(actor, 'dup', 'surv');

    for (const m of MOVED_MODELS) {
      expect(tx[m]!.updateMany).toHaveBeenCalledWith({
        where: { customerId: 'dup' },
        data: { customerId: 'surv' },
      });
    }
    expect(tx.customer!.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'dup' },
      data: expect.objectContaining({ mergedIntoId: 'surv', defaultAddressId: null, loyaltyPoints: 0 }),
    });
    expect(tx.customer!.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'surv' },
      data: expect.objectContaining({
        email: 'd@x.com',
        defaultAddressId: 'addr_dup',
        tags: ['b', 'a'],
        loyaltyPoints: 35,
        totalBookings: 3,
        lifetimeValueMinor: 50_000n,
        customFields: { gate: '9', floor: '2' },
      }),
    });
  });

  it('moves the referral code only when the survivor has none', async () => {
    const { service, tx } = build();
    tx.customer!.findFirst!
      .mockResolvedValueOnce(customerRow({ id: 'dup' }))
      .mockResolvedValueOnce(customerRow({ id: 'surv' }));
    tx.referralCode!.findUnique!
      .mockResolvedValueOnce({ id: 'rc_dup' })
      .mockResolvedValueOnce({ id: 'rc_surv' });
    await service.merge(actor, 'dup', 'surv');
    expect(tx.referralCode!.update).toHaveBeenCalledWith({
      where: { id: 'rc_dup' },
      data: { deletedAt: expect.any(Date) },
    });
  });
});
