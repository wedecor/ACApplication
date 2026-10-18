import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Permission } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { buildInvoiceLines, FieldBillingService } from '../field-billing/field-billing.service';
import { RepairAccessService } from '../repair-access.service';

const tech = {
  userId: 'u_tech',
  tenantId: 't1',
  roles: ['TECHNICIAN'],
  permissions: [Permission.JOBCARD_WRITE],
} as unknown as AuthPrincipal;
const techNoWrite = { ...tech, permissions: [] } as unknown as AuthPrincipal;
const dispatcher = {
  userId: 'u_disp',
  tenantId: 't1',
  roles: ['DISPATCHER'],
  permissions: [Permission.BOOKING_READ, Permission.INVOICE_VIEW, Permission.PAYMENT_MANAGE],
} as unknown as AuthPrincipal;

const invoice = {
  id: 'inv1',
  number: 'INV-2026-000001',
  status: 'DRAFT',
  totalMinor: 100_000,
  amountPaidMinor: 0,
  dueAmountMinor: 100_000,
  currency: 'INR',
};

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'b1',
    code: 'ACB-1',
    status: 'IN_PROGRESS',
    customerId: 'c1',
    technicianId: 'tech_1',
    category: 'AC_REPAIR',
    serviceType: null,
    isWarrantyRevisit: false,
    finalAmountMinor: null,
    estimatedAmountMinor: 0,
    catalogItem: null,
    invoice: null,
    quotation: null,
    ...overrides,
  };
}

function build(row: Record<string, unknown> | null) {
  const prisma = {
    client: {
      booking: { findFirst: jest.fn().mockResolvedValue(row) },
      technician: { findFirst: jest.fn().mockResolvedValue({ id: 'tech_1' }) },
      invoice: { findFirst: jest.fn().mockResolvedValue((row?.['invoice'] as unknown) ?? null) },
      quotation: { findFirst: jest.fn().mockResolvedValue(null) },
      payment: { findMany: jest.fn().mockResolvedValue([]) },
      paymentTransaction: { findFirst: jest.fn().mockResolvedValue(null) },
    },
  };
  const invoices = { createFromLineItems: jest.fn(), applyPayment: jest.fn(), send: jest.fn() };
  const payments = {
    createPaymentLink: jest.fn().mockResolvedValue({
      transaction: { id: 'ptx1', status: 'PENDING' },
      hostedLink: 'https://pay/x',
    }),
  };
  const quotations = {
    convertToInvoice: jest.fn(),
    send: jest.fn(),
    approvalUrl: jest.fn((token: string) => `https://example.test/quotations/${token}`),
  };
  const svc = new FieldBillingService(
    prisma as never,
    new RepairAccessService(prisma as never),
    invoices as never,
    payments as never,
    quotations as never,
  );
  return { svc, prisma, invoices, payments, quotations };
}

describe('FieldBillingService access', () => {
  it('rejects a technician on a booking assigned to someone else', async () => {
    const { svc, invoices, payments } = build(booking({ technicianId: 'other_tech', invoice }));
    await expect(svc.summary(tech, 'b1')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.createInvoice(tech, 'b1')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      svc.recordPayment(tech, 'b1', { method: 'CASH', amountMinor: 100 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.paymentLink(tech, 'b1')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.sendQuotation(tech, 'b1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(invoices.createFromLineItems).not.toHaveBeenCalled();
    expect(invoices.applyPayment).not.toHaveBeenCalled();
    expect(payments.createPaymentLink).not.toHaveBeenCalled();
  });

  it('rejects a technician without jobcard:write even on their own booking', async () => {
    const { svc } = build(booking());
    await expect(svc.summary(techNoWrite, 'b1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets the assigned technician read the summary', async () => {
    const { svc } = build(booking({ invoice }));
    const res = await svc.summary(tech, 'b1');
    expect(res.invoice?.dueAmountMinor).toBe(100_000);
    expect(res.paymentLink).toBeNull();
  });

  it('lets staff with the operation permissions through regardless of assignment', async () => {
    const { svc } = build(booking({ technicianId: 'other_tech', invoice }));
    await expect(svc.summary(dispatcher, 'b1')).resolves.toBeDefined();
  });

  it('requires staff to hold the per-operation permission', async () => {
    const { svc } = build(booking());
    // dispatcher fixture lacks invoice:create
    await expect(svc.createInvoice(dispatcher, 'b1')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('FieldBillingService.createInvoice', () => {
  it('is idempotent when the booking already has an invoice', async () => {
    const { svc, invoices } = build(booking({ invoice }));
    const res = await svc.createInvoice(tech, 'b1');
    expect(invoices.createFromLineItems).not.toHaveBeenCalled();
    expect(res.invoice?.id).toBe('inv1');
  });

  it('only invoices IN_PROGRESS or COMPLETED bookings', async () => {
    const { svc } = build(booking({ status: 'ASSIGNED', finalAmountMinor: 50_000 }));
    await expect(svc.createInvoice(tech, 'b1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('converts an approved quotation', async () => {
    const { svc, quotations, invoices } = build(
      booking({ quotation: { id: 'q1', number: 'QTN-1', status: 'APPROVED', totalMinor: 1, viewToken: 'v' } }),
    );
    await svc.createInvoice(tech, 'b1');
    expect(quotations.convertToInvoice).toHaveBeenCalledWith(tech, 'q1');
    expect(invoices.createFromLineItems).not.toHaveBeenCalled();
  });

  it('builds lines from the final amount otherwise', async () => {
    const { svc, invoices } = build(booking({ finalAmountMinor: 150_000, status: 'COMPLETED' }));
    await svc.createInvoice(tech, 'b1');
    const [, customerId, lines, opts] = invoices.createFromLineItems.mock.calls[0];
    expect(customerId).toBe('c1');
    expect(lines).toEqual([expect.objectContaining({ unitPriceMinor: 150_000, quantity: 1 })]);
    expect(opts).toEqual(expect.objectContaining({ bookingId: 'b1' }));
  });

  it('issues the new invoice so payments land on a SENT invoice', async () => {
    const { svc, invoices, prisma } = build(booking({ finalAmountMinor: 150_000, status: 'COMPLETED' }));
    prisma.client.invoice.findFirst.mockResolvedValueOnce({ id: 'inv_new' });
    await svc.createInvoice(tech, 'b1');
    expect(prisma.client.invoice.findFirst.mock.calls[0][0].where).toMatchObject({ bookingId: 'b1', status: 'DRAFT' });
    expect(invoices.send).toHaveBeenCalledWith(tech, 'inv_new');
  });

  it('refuses when there is nothing to invoice', async () => {
    const { svc } = build(booking());
    await expect(svc.createInvoice(tech, 'b1')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('FieldBillingService payments', () => {
  it('rejects an amount above the amount due', async () => {
    const { svc, invoices } = build(booking({ invoice }));
    await expect(
      svc.recordPayment(tech, 'b1', { method: 'UPI', amountMinor: 100_001 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(invoices.applyPayment).not.toHaveBeenCalled();
  });

  it('records the payment through InvoicesService.applyPayment', async () => {
    const { svc, invoices } = build(booking({ invoice }));
    await svc.recordPayment(tech, 'b1', { method: 'UPI', amountMinor: 40_000, reference: 'UTR123' });
    expect(invoices.applyPayment).toHaveBeenCalledWith(
      'inv1',
      expect.objectContaining({ tenantId: 't1', amountMinor: 40_000, method: 'UPI', gatewayRef: 'UTR123' }),
    );
  });

  it('requires an invoice before collecting', async () => {
    const { svc } = build(booking());
    await expect(
      svc.recordPayment(tech, 'b1', { method: 'CASH', amountMinor: 1 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('reuses an open payment link for the same amount', async () => {
    const { svc, prisma, payments } = build(booking({ invoice }));
    prisma.client.paymentTransaction.findFirst.mockResolvedValue({
      id: 'ptx0',
      hostedLink: 'https://pay/old',
      status: 'PENDING',
    });
    await expect(svc.paymentLink(tech, 'b1')).resolves.toEqual({
      id: 'ptx0',
      url: 'https://pay/old',
      status: 'PENDING',
    });
    expect(payments.createPaymentLink).not.toHaveBeenCalled();
  });

  it('creates a new payment link otherwise', async () => {
    const { svc, payments } = build(booking({ invoice }));
    await expect(svc.paymentLink(tech, 'b1')).resolves.toEqual({
      id: 'ptx1',
      url: 'https://pay/x',
      status: 'PENDING',
    });
    expect(payments.createPaymentLink).toHaveBeenCalledWith(tech, { invoiceId: 'inv1' });
  });
});

describe('FieldBillingService.sendQuotation', () => {
  it('sends a DRAFT quotation', async () => {
    const { svc, quotations } = build(
      booking({ quotation: { id: 'q1', number: 'QTN-1', status: 'DRAFT', totalMinor: 5, viewToken: 'v' } }),
    );
    quotations.send.mockResolvedValue({ id: 'q1', number: 'QTN-1', status: 'SENT', totalMinor: 5, viewToken: 'v' });
    await expect(svc.sendQuotation(tech, 'b1')).resolves.toEqual(
      expect.objectContaining({ status: 'SENT', viewToken: 'v' }),
    );
  });
});

describe('buildInvoiceLines', () => {
  const base = {
    code: 'ACB-1',
    category: 'AC_REPAIR',
    serviceType: null,
    isWarrantyRevisit: false,
    finalAmountMinor: null,
    estimatedAmountMinor: 0,
    catalogItem: null,
  };

  it('uses catalog base + visit charge with GST', () => {
    const lines = buildInvoiceLines({
      ...base,
      catalogItem: { name: 'Gas refill', basePriceMinor: 249_900, visitChargeMinor: 29_900, gstRateBps: 1800, sacCode: '998719' },
    });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual(expect.objectContaining({ unitPriceMinor: 249_900, taxRateBps: 1800 }));
  });

  it('returns nothing for warranty revisits', () => {
    expect(buildInvoiceLines({ ...base, isWarrantyRevisit: true, finalAmountMinor: 100 })).toEqual([]);
  });
});
