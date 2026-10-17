import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { markdownToPlain, MeAccountService } from '../me-account.service';
import { MeAddressesService } from '../me-addresses.service';
import { MeAmcService, planCoversCategory } from '../me-amc.service';
import { MeAppliancesService } from '../me-appliances.service';
import { MeContextService } from '../me-context.service';
import { MeInvoicesService, signInvoicePdf, verifyInvoicePdfSignature } from '../me-invoices.service';
import { MeNotificationsService } from '../me-notifications.service';
import { MePaymentMethodsService } from '../me-payment-methods.service';

const actor = { userId: 'u1', tenantId: 't1', sessionId: 's1' } as never;
const customer = { id: 'c1', tenantId: 't1', userId: 'u1', fullName: 'A', phone: '+91', email: null, cityId: null, defaultAddressId: null };
const ctx = () => ({ requireCustomer: jest.fn().mockResolvedValue(customer) });

describe('MeContextService', () => {
  it('throws Forbidden when no customer is linked', async () => {
    const prisma = { client: { customer: { findFirst: jest.fn().mockResolvedValue(null) } } };
    await expect(new MeContextService(prisma as never).requireCustomer(actor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.client.customer.findFirst.mock.calls[0][0].where).toMatchObject({ userId: 'u1', tenantId: 't1' });
  });
});

describe('invoice pdf links', () => {
  it('verifies a fresh signature and rejects tampering / expiry', () => {
    const exp = 2_000_000_000;
    const sig = signInvoicePdf('secret', 'inv1', 't1', exp);
    expect(verifyInvoicePdfSignature('secret', 'inv1', 't1', exp, sig, exp - 10)).toBe(true);
    expect(verifyInvoicePdfSignature('secret', 'inv2', 't1', exp, sig, exp - 10)).toBe(false);
    expect(verifyInvoicePdfSignature('secret', 'inv1', 't1', exp, sig, exp + 1)).toBe(false);
    expect(verifyInvoicePdfSignature('secret', 'inv1', 't1', exp, 'abcd', exp - 10)).toBe(false);
  });
});

describe('MeInvoicesService', () => {
  const env = { JWT_SECRET: 'x'.repeat(32), API_URL: 'http://api', RAZORPAY_KEY_ID: 'rzp_test' };
  function build(invoice: Record<string, unknown> | null) {
    const prisma = {
      client: {
        invoice: { findFirst: jest.fn().mockResolvedValue(invoice), findMany: jest.fn() },
        savedPaymentMethod: { findFirst: jest.fn() },
        paymentTransaction: { findFirst: jest.fn() },
      },
    };
    const payments = { createPaymentLink: jest.fn() };
    const svc = new MeInvoicesService(prisma as never, ctx() as never, {} as never, payments as never, env as never);
    return { svc, prisma, payments };
  }
  it('hides drafts and scopes by customer', async () => {
    const { svc, prisma } = build(null);
    await expect(svc.detail(actor, 'i1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.client.invoice.findFirst.mock.calls[0][0].where).toMatchObject({
      customerId: 'c1',
      status: { notIn: ['DRAFT'] },
    });
  });
  it('refuses to pay a settled invoice', async () => {
    const { svc } = build({ id: 'i1', status: 'PAID', dueAmountMinor: 0, lineItems: [] });
    await expect(svc.pay(actor, 'i1', { gateway: 'razorpay' })).rejects.toBeInstanceOf(ConflictException);
  });
  it('starts a hosted checkout via PaymentsService', async () => {
    const { svc, payments } = build({ id: 'i1', status: 'SENT', dueAmountMinor: 500, lineItems: [] });
    payments.createPaymentLink.mockResolvedValue({
      transaction: { id: 'tx1', orderRef: 'plink_1', amountMinor: 500, currency: 'INR' },
      hostedLink: 'https://rzp.io/x',
    });
    const res = await svc.pay(actor, 'i1', { gateway: 'razorpay' });
    expect(res).toMatchObject({ gateway: 'razorpay', orderId: 'plink_1', key: 'rzp_test', amountMinor: 500, checkoutUrl: 'https://rzp.io/x' });
    expect(payments.createPaymentLink).toHaveBeenCalledWith(actor, expect.objectContaining({ invoiceId: 'i1', provider: 'razorpay' }));
  });
  it('maps confirm status and builds a signed receipt link', async () => {
    const { svc } = build({ id: 'i1', status: 'PAID', dueAmountMinor: 0, pdfUrl: null, lineItems: [] });
    const res = await svc.confirm(actor, 'i1', {});
    expect(res.status).toBe('PAID');
    expect(res.receiptUrl).toMatch(/^http:\/\/api\/api\/v1\/me\/invoices\/i1\/pdf\?t=t1&exp=\d+&sig=[a-f0-9]{64}$/);
  });
});

describe('MePaymentMethodsService', () => {
  it('404s when setting default on a method that is not mine', async () => {
    const prisma = { client: { savedPaymentMethod: { findFirst: jest.fn().mockResolvedValue(null) } } };
    const svc = new MePaymentMethodsService(prisma as never, ctx() as never);
    await expect(svc.setDefault(actor, 'pm1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.client.savedPaymentMethod.findFirst.mock.calls[0][0].where).toMatchObject({ customerId: 'c1' });
  });
  it('never returns gateway tokens', async () => {
    const prisma = {
      client: {
        savedPaymentMethod: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'pm1', gateway: 'razorpay', type: 'card', label: 'Visa', last4: '4242', brand: 'visa', isDefault: true, expiresAt: null },
          ]),
        },
      },
    };
    const svc = new MePaymentMethodsService(prisma as never, ctx() as never);
    const [m] = await svc.list(actor);
    expect(m).not.toHaveProperty('gatewayToken');
    expect(m!.type).toBe('CARD');
    expect(prisma.client.savedPaymentMethod.findMany.mock.calls[0][0].select.gatewayToken).toBeUndefined();
  });
});

describe('MeAmcService', () => {
  it('planCoversCategory treats AC_* as one family and empty as all', () => {
    expect(planCoversCategory([], 'GEYSER')).toBe(true);
    expect(planCoversCategory(['AC_SERVICING'], 'AC_REPAIR')).toBe(true);
    expect(planCoversCategory(['AC_SERVICING'], 'GEYSER')).toBe(false);
  });

  function build() {
    const prisma = {
      client: {
        aMCPlan: { findFirst: jest.fn().mockResolvedValue({ id: 'p1', appliancesCovered: ['AC_SERVICING'] }) },
        address: { findFirst: jest.fn().mockResolvedValue({ id: 'a1' }) },
        customerAppliance: { findMany: jest.fn().mockResolvedValue([]) },
        aMCSubscription: { update: jest.fn(), findFirst: jest.fn() },
        invoice: { findFirst: jest.fn() },
      },
    };
    const subs = { subscribe: jest.fn().mockResolvedValue({ subscription: { id: 's1' }, invoice: { id: 'i1' } }) };
    const invoices = { send: jest.fn(), createFromLineItems: jest.fn().mockResolvedValue({ id: 'i2' }) };
    return { svc: new MeAmcService(prisma as never, ctx() as never, subs as never, invoices as never), prisma, subs, invoices };
  }

  it('rejects appliances the plan does not cover', async () => {
    const { svc } = build();
    await expect(svc.purchase(actor, { planId: 'p1', appliances: ['GEYSER'], addressId: 'a1' })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects appliance ids that are not mine', async () => {
    const { svc } = build();
    await expect(svc.purchase(actor, { planId: 'p1', appliances: ['someone-elses'], addressId: 'a1' })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('subscribes via AmcSubscriptionsService and issues the invoice', async () => {
    const { svc, subs, invoices } = build();
    const res = await svc.purchase(actor, { planId: 'p1', appliances: ['AC_REPAIR'], addressId: 'a1' });
    expect(res).toEqual({ subscriptionId: 's1', invoiceId: 'i1' });
    expect(subs.subscribe.mock.calls[0][1]).toMatchObject({ customerId: 'c1', planId: 'p1' });
    expect(invoices.send).toHaveBeenCalledWith(actor, 'i1');
  });
  it('returns an already-open renewal invoice instead of duplicating', async () => {
    const { svc, prisma, invoices } = build();
    prisma.client.aMCSubscription.findFirst.mockResolvedValue({
      id: 's1', status: 'ACTIVE', startsAt: new Date(), number: 'AMC-1', priceMinor: 100, renewalPriceMinor: 90,
      plan: { name: 'Gold', durationMonths: 12, isActive: true, renewalPriceMinor: 90, priceMinor: 100 },
    });
    prisma.client.invoice.findFirst.mockResolvedValue({ id: 'open1' });
    expect(await svc.renew(actor, 's1')).toEqual({ invoiceId: 'open1' });
    expect(invoices.createFromLineItems).not.toHaveBeenCalled();
  });
  it('refuses to renew cancelled subscriptions', async () => {
    const { svc, prisma } = build();
    prisma.client.aMCSubscription.findFirst.mockResolvedValue({ id: 's1', status: 'CANCELLED', plan: { isActive: true } });
    await expect(svc.renew(actor, 's1')).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('MeNotificationsService', () => {
  it('404s for notifications of other users', async () => {
    const prisma = { client: { notification: { findFirst: jest.fn().mockResolvedValue(null) } } };
    const svc = new MeNotificationsService(prisma as never, {} as never);
    await expect(svc.markRead(actor, 'n1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.client.notification.findFirst.mock.calls[0][0].where).toMatchObject({ userId: 'u1' });
  });
  it('does not flip delivery status of queued rows', async () => {
    const update = jest.fn();
    const prisma = { client: { notification: { findFirst: jest.fn().mockResolvedValue({ id: 'n1', readAt: null, status: 'QUEUED' }), update } } };
    await new MeNotificationsService(prisma as never, {} as never).markRead(actor, 'n1');
    expect(update.mock.calls[0][0].data.status).toBeUndefined();
  });
  it('lists, dedupes IN_APP/PUSH copies and renders titles', async () => {
    const at = new Date('2026-01-01T00:00:00Z');
    const prisma = {
      client: {
        notification: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'n1', template: 'booking.assigned', channel: 'IN_APP', payload: { bookingId: 'b1' }, readAt: null, createdAt: at },
            { id: 'n2', template: 'booking.assigned', channel: 'PUSH', payload: { bookingId: 'b1' }, readAt: null, createdAt: at },
          ]),
        },
      },
    };
    const repo = { buildMessage: jest.fn().mockResolvedValue({ text: 'Ravi is assigned' }) };
    const list = await new MeNotificationsService(prisma as never, repo as never).list(actor);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ title: 'Booking assigned', body: 'Ravi is assigned', type: 'BOOKING', data: { bookingId: 'b1' } });
  });
});

describe('MeAddressesService', () => {
  it('makes the first address the default and derives state from the city', async () => {
    const created = { id: 'a1', label: 'HOME', line1: 'L1', line2: null, city: 'Pune', state: 'MH', pincode: '411001', landmark: null, latitude: null, longitude: null };
    const prisma = {
      client: {
        city: { findFirst: jest.fn().mockResolvedValue({ state: 'MH' }) },
        address: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue(created) },
        customer: { update: jest.fn() },
      },
    };
    const res = await new MeAddressesService(prisma as never, ctx() as never).create(actor, { label: 'HOME', line1: 'L1', city: 'Pune', pincode: '411001' });
    expect(prisma.client.address.create.mock.calls[0][0].data).toMatchObject({ customerId: 'c1', state: 'MH' });
    expect(prisma.client.customer.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { defaultAddressId: 'a1' } });
    expect(res.isDefault).toBe(true);
  });
});

describe('MeAppliancesService', () => {
  const storage = { isConfigured: () => true, isTenantObjectUrl: (u: string) => u.startsWith('http://s3/t1/') };
  it('rejects photos not uploaded through our storage', async () => {
    const svc = new MeAppliancesService({ client: {} } as never, ctx() as never, storage as never);
    await expect(svc.create(actor, { category: 'AC_REPAIR', brand: 'LG', photos: ['http://evil/x.png'] })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('creates scoped to the customer and returns warranty status', async () => {
    const row = {
      id: 'ap1', category: 'AC_REPAIR', brand: 'LG', modelNumber: null, serialNumber: null, capacity: '1.5 ton', installedLocation: null,
      purchaseDate: null, installDate: null, manufacturerWarrantyUntil: new Date(Date.now() + 10 * 86_400_000), extendedWarrantyUntil: null,
      photos: [], addressId: null, notes: null, lastServicedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };
    const prisma = { client: { customerAppliance: { create: jest.fn().mockResolvedValue(row) } } };
    const res = await new MeAppliancesService(prisma as never, ctx() as never, storage as never).create(actor, { category: 'AC_REPAIR', brand: ' LG ' });
    expect(prisma.client.customerAppliance.create.mock.calls[0][0].data).toMatchObject({ tenantId: 't1', customerId: 'c1', brand: 'LG' });
    expect(res.warranty.status).toBe('EXPIRING_SOON');
  });
  it('404s for appliances that are not mine', async () => {
    const prisma = { client: { customerAppliance: { findFirst: jest.fn().mockResolvedValue(null) } } };
    await expect(new MeAppliancesService(prisma as never, ctx() as never, storage as never).remove(actor, 'x')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('MeAccountService', () => {
  it('revokes sessions + push tokens of my device only', async () => {
    const prisma = {
      client: {
        session: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        pushDevice: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      },
    };
    await new MeAccountService(prisma as never).revokeDevice(actor, 'dev1');
    expect(prisma.client.session.updateMany.mock.calls[0][0].where).toMatchObject({ userId: 'u1' });
  });
  it('404s for unknown devices', async () => {
    const prisma = {
      client: {
        session: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        pushDevice: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      },
    };
    await expect(new MeAccountService(prisma as never).revokeDevice(actor, 'x')).rejects.toBeInstanceOf(NotFoundException);
  });
  it('maps published KB articles to FAQ pairs', async () => {
    const prisma = {
      client: {
        tenant: { findFirst: jest.fn().mockResolvedValue({ id: 't1' }) },
        knowledgeBaseArticle: { findMany: jest.fn().mockResolvedValue([{ slug: 's', title: 'How?', excerpt: null, bodyMarkdown: '# Hi\n**Bold** [link](http://x)' }]) },
      },
    };
    expect(await new MeAccountService(prisma as never).faqs('acme')).toEqual([{ q: 'How?', a: 'Hi\nBold link', slug: 's' }]);
    expect(prisma.client.knowledgeBaseArticle.findMany.mock.calls[0][0].where).toMatchObject({ status: 'PUBLISHED', visibility: 'PUBLIC' });
  });
  it('markdownToPlain strips formatting', () => {
    expect(markdownToPlain('- a\n- _b_')).toBe('• a\n• b');
  });
});
