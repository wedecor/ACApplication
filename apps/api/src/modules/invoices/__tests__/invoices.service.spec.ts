import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import type { AuthPrincipal } from '@ac/auth';
import {
  CreditNoteStatus,
  DomainEventName,
  InvoiceStatus,
  LedgerEntryDirection,
  LedgerEntryType,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
} from '@ac/types';

import type { CreateInvoiceDto } from '../dto/create-invoice.dto';
import type { ListInvoicesDto } from '../dto/list-invoices.dto';
import { InvoicesService, refundedBalance } from '../invoices.service';

/**
 * Unit tests for InvoicesService. Prisma is fully mocked:
 *  - `prisma.client.*` is used for non-transactional reads/writes;
 *  - `prisma.client.$transaction(fn)` invokes `fn(tx)` with a separate `tx`
 *    mock, mirroring the interactive-transaction API. `nextDocumentNumber`
 *    also goes through `$transaction`, so the numbering lookup lands on
 *    `tx.<table>.findFirst` and the counter upsert on `tx.$queryRaw`.
 */

const HOME_STATE = (process.env.GST_HOME_STATE ?? 'KA').toUpperCase();
const OTHER_STATE = HOME_STATE === 'MH' ? 'KA' : 'MH';
const YEAR = new Date().getUTCFullYear();

const actor = { tenantId: 'tenant_1', userId: 'user_1' } as unknown as AuthPrincipal;

function model() {
  return {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    aggregate: jest.fn(),
  };
}

function buildService() {
  const tx = {
    $queryRaw: jest.fn(async (_sql: TemplateStringsArray, ...values: unknown[]) => [{ lastValue: values[3] as number }]),
    invoice: model(),
    invoiceLineItem: model(),
    payment: model(),
    refund: model(),
    creditNote: model(),
  };
  const client = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    customer: model(),
    booking: model(),
    invoice: model(),
  };
  // Echo back created invoices so tests can inspect computed numbers.
  client.invoice.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'inv_1',
    ...data,
    lineItems: (data.lineItems as { create: unknown[] }).create,
  }));
  client.customer.findFirst.mockResolvedValue({ id: 'cust_1', fullName: 'Test Customer' });
  tx.invoice.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'inv_1',
    ...data,
  }));

  const prisma = { client };
  const ledger = { post: jest.fn().mockResolvedValue({ id: 'led_1' }) };
  const events = { publish: jest.fn(), emit: jest.fn() };
  const pdf = { invoice: jest.fn(), quotation: jest.fn() };
  const svc = new InvoicesService(prisma as never, ledger as never, events as never, pdf as never);
  return { svc, prisma, client, tx, ledger, events, pdf };
}

function dto(overrides: Partial<CreateInvoiceDto> = {}): CreateInvoiceDto {
  return {
    customerId: 'cust_1',
    lineItems: [{ description: 'AC service', quantity: 1, unitPriceMinor: 100_000, taxRateBps: 1800 }],
    ...overrides,
  };
}

type CreateArgs = {
  data: {
    subtotalMinor: number;
    discountMinor: number;
    taxMinor: number;
    totalMinor: number;
    dueAmountMinor: number;
    status: string;
    number: string;
    placeOfSupply: string | null;
    gstEnabled: boolean;
    currency: string;
    dueDate: Date | null;
    bookingId: string | null;
    generatedBy: string;
    lineItems: {
      create: Array<{
        subtotalMinor: number;
        taxMinor: number;
        totalMinor: number;
        cgstMinor: number;
        sgstMinor: number;
        igstMinor: number;
        discountMinor: number;
        taxRateBps: number;
        hsnSacCode: string | null;
      }>;
    };
  };
};

function createArgs(client: ReturnType<typeof buildService>['client']): CreateArgs {
  return client.invoice.create.mock.calls[0][0] as CreateArgs;
}

// ---------------------------------------------------------------------------
describe('InvoicesService.create', () => {
  it('rejects an empty line-item list before touching the DB', async () => {
    const { svc, client } = buildService();
    await expect(svc.create(actor, dto({ lineItems: [] }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(client.customer.findFirst).not.toHaveBeenCalled();
  });

  it('404s when the customer is not in the tenant', async () => {
    const { svc, client } = buildService();
    client.customer.findFirst.mockResolvedValue(null);
    await expect(svc.create(actor, dto())).rejects.toBeInstanceOf(NotFoundException);
    expect(client.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cust_1', tenantId: 'tenant_1' } }),
    );
  });

  it('404s when the booking is not found', async () => {
    const { svc, client } = buildService();
    client.booking.findFirst.mockResolvedValue(null);
    await expect(svc.create(actor, dto({ bookingId: 'bk_1' }))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('409s when the booking already has an invoice', async () => {
    const { svc, client } = buildService();
    client.booking.findFirst.mockResolvedValue({ id: 'bk_1', invoice: { id: 'inv_old' } });
    await expect(svc.create(actor, dto({ bookingId: 'bk_1' }))).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(client.invoice.create).not.toHaveBeenCalled();
  });

  it('creates a DRAFT with computed totals, defaults and a sequential number', async () => {
    const { svc, client, tx, events } = buildService();
    client.booking.findFirst.mockResolvedValue({ id: 'bk_1', invoice: null });
    tx.invoice.findFirst.mockResolvedValue({ number: `INV-${YEAR}-000041` });

    const inv = await svc.create(
      actor,
      dto({
        bookingId: 'bk_1',
        lineItems: [
          { description: 'Gas refill', quantity: 2, unitPriceMinor: 50_000, discountMinor: 10_000, taxRateBps: 1800, hsnSacCode: '9987' },
          { description: 'Visit fee', quantity: 1, unitPriceMinor: 20_000 },
        ],
      }),
    );

    const { data } = createArgs(client);
    expect(data.number).toBe(`INV-${YEAR}-000042`);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(data.status).toBe(InvoiceStatus.DRAFT);
    // line 1: 2*50_000 - 10_000 = 90_000 → 18% = 16_200; line 2: 20_000, no tax
    expect(data.subtotalMinor).toBe(110_000);
    expect(data.taxMinor).toBe(16_200);
    expect(data.discountMinor).toBe(0);
    expect(data.totalMinor).toBe(126_200);
    expect(data.dueAmountMinor).toBe(126_200);
    expect(data.currency).toBe('INR');
    expect(data.gstEnabled).toBe(true);
    expect(data.placeOfSupply).toBeNull();
    expect(data.dueDate).toBeNull();
    expect(data.bookingId).toBe('bk_1');
    expect(data.generatedBy).toBe('user_1');

    const [l1, l2] = data.lineItems.create;
    expect(l1).toMatchObject({ subtotalMinor: 90_000, taxMinor: 16_200, totalMinor: 106_200, hsnSacCode: '9987', discountMinor: 10_000 });
    expect(l2).toMatchObject({ subtotalMinor: 20_000, taxMinor: 0, totalMinor: 20_000, taxRateBps: 0, discountMinor: 0, hsnSacCode: null });

    expect(inv.id).toBe('inv_1');
    expect(events.publish).toHaveBeenCalledWith(
      DomainEventName.InvoiceCreated,
      expect.objectContaining({ invoiceId: 'inv_1', customerId: 'cust_1', totalMinor: 126_200, bookingId: 'bk_1' }),
    );
  });

  it('starts numbering at 000001 when no prior invoice exists this year', async () => {
    const { svc, client, tx } = buildService();
    tx.invoice.findFirst.mockResolvedValue(null);
    await svc.create(actor, dto());
    expect(createArgs(client).data.number).toBe(`INV-${YEAR}-000001`);
  });

  it('splits GST into CGST + SGST for intra-state supply', async () => {
    const { svc, client } = buildService();
    await svc.create(actor, dto({ placeOfSupply: HOME_STATE.toLowerCase() }));
    const { data } = createArgs(client);
    expect(data.placeOfSupply).toBe(HOME_STATE); // upper-cased
    expect(data.lineItems.create[0]).toMatchObject({ cgstMinor: 9_000, sgstMinor: 9_000, igstMinor: 0, taxMinor: 18_000 });
  });

  it('charges IGST for inter-state supply', async () => {
    const { svc, client } = buildService();
    await svc.create(actor, dto({ placeOfSupply: OTHER_STATE }));
    expect(createArgs(client).data.lineItems.create[0]).toMatchObject({ cgstMinor: 0, sgstMinor: 0, igstMinor: 18_000 });
  });

  it('treats a missing place of supply as inter-state (IGST)', async () => {
    const { svc, client } = buildService();
    await svc.create(actor, dto());
    expect(createArgs(client).data.lineItems.create[0]).toMatchObject({ cgstMinor: 0, sgstMinor: 0, igstMinor: 18_000 });
  });

  it('applies banker\'s rounding (half-to-even) to line tax', async () => {
    const { svc, client } = buildService();
    await svc.create(
      actor,
      dto({
        lineItems: [
          // 25 * 18% = 4.5 → 4 (round down to even)
          { description: 'a', quantity: 1, unitPriceMinor: 25, taxRateBps: 1800 },
          // 75 * 18% = 13.5 → 14 (round up to even)
          { description: 'b', quantity: 1, unitPriceMinor: 75, taxRateBps: 1800 },
          // 10 * 5% = 0.5 → 0
          { description: 'c', quantity: 1, unitPriceMinor: 10, taxRateBps: 500 },
          // 30 * 5% = 1.5 → 2
          { description: 'd', quantity: 1, unitPriceMinor: 30, taxRateBps: 500 },
        ],
      }),
    );
    const { data } = createArgs(client);
    expect(data.lineItems.create.map((l) => l.taxMinor)).toEqual([4, 14, 0, 2]);
    expect(data.taxMinor).toBe(20);
    expect(data.subtotalMinor).toBe(140);
    expect(data.totalMinor).toBe(160);
  });

  it('rounds each CGST half independently and gives SGST the remainder (intra-state)', async () => {
    const { svc, client } = buildService();
    await svc.create(
      actor,
      dto({
        placeOfSupply: HOME_STATE,
        // 50 * 18% = 9; CGST = 50 * 9% = 4.5 → 4; SGST = 9 - 4 = 5
        lineItems: [{ description: 'x', quantity: 1, unitPriceMinor: 50, taxRateBps: 1800 }],
      }),
    );
    expect(createArgs(client).data.lineItems.create[0]).toMatchObject({ taxMinor: 9, cgstMinor: 4, sgstMinor: 5, igstMinor: 0 });
  });

  it('applies the invoice-level discount after tax and caps it at the gross total', async () => {
    const { svc, client } = buildService();
    await svc.create(actor, dto({ discountMinor: 8_000 }));
    let { data } = createArgs(client);
    expect(data).toMatchObject({ subtotalMinor: 100_000, taxMinor: 18_000, discountMinor: 8_000, totalMinor: 110_000, dueAmountMinor: 110_000 });

    const second = buildService();
    await second.svc.create(actor, dto({ discountMinor: 999_999 }));
    data = createArgs(second.client).data;
    expect(data).toMatchObject({ taxMinor: 18_000, discountMinor: 118_000, totalMinor: 0, dueAmountMinor: 0 });
  });

  it('floors a line discount larger than gross at zero', async () => {
    const { svc, client } = buildService();
    await svc.create(
      actor,
      dto({ lineItems: [{ description: 'x', quantity: 1, unitPriceMinor: 1_000, discountMinor: 5_000, taxRateBps: 1800 }] }),
    );
    expect(createArgs(client).data).toMatchObject({ subtotalMinor: 0, taxMinor: 0, totalMinor: 0 });
  });

  it('zeroes tax when GST is disabled', async () => {
    const { svc, client } = buildService();
    await svc.create(actor, dto({ gstEnabled: false, placeOfSupply: HOME_STATE }));
    const { data } = createArgs(client);
    expect(data).toMatchObject({ gstEnabled: false, taxMinor: 0, totalMinor: 100_000 });
    expect(data.lineItems.create[0]).toMatchObject({ cgstMinor: 0, sgstMinor: 0, igstMinor: 0 });
  });

  it('passes through dueDate and currency', async () => {
    const { svc, client } = buildService();
    await svc.create(actor, dto({ dueDate: '2026-12-01T00:00:00.000Z', currency: 'USD' }));
    const { data } = createArgs(client);
    expect(data.dueDate).toEqual(new Date('2026-12-01T00:00:00.000Z'));
    expect(data.currency).toBe('USD');
  });

  it('throws a raw Error (not an HttpException) for non-integer money from the finance helpers', async () => {
    // NOTE: current behaviour — computeLineTax/ensureInteger throw plain Error,
    // which surfaces as a 500 if DTO validation is bypassed (e.g. internal callers).
    const { svc } = buildService();
    const p = svc.create(
      actor,
      dto({ lineItems: [{ description: 'x', quantity: 1, unitPriceMinor: 10.5, taxRateBps: 1800 }] }),
    );
    await expect(p).rejects.toThrow('must be an integer count of minor units');
    await expect(p).rejects.not.toBeInstanceOf(BadRequestException);
  });
});

// ---------------------------------------------------------------------------
describe('InvoicesService.createFromLineItems', () => {
  it('delegates to create with mapped options', async () => {
    const { svc } = buildService();
    const spy = jest.spyOn(svc, 'create').mockResolvedValue({ id: 'inv_x' } as never);
    const due = new Date('2026-11-01T00:00:00.000Z');
    const lines = [{ description: 'AMC', quantity: 1, unitPriceMinor: 5_000 }];
    await svc.createFromLineItems(actor, 'cust_1', lines, {
      amcSubscriptionId: 'amc_1',
      bookingId: null,
      dueDate: due,
      notes: null,
      gstEnabled: false,
      placeOfSupply: 'ka',
    });
    expect(spy).toHaveBeenCalledWith(actor, {
      customerId: 'cust_1',
      bookingId: undefined,
      amcSubscriptionId: 'amc_1',
      lineItems: lines,
      gstEnabled: false,
      placeOfSupply: 'ka',
      dueDate: due.toISOString(),
      notes: undefined,
      currency: undefined,
    });
  });
});

// ---------------------------------------------------------------------------
describe('InvoicesService.list', () => {
  function listDto(o: Partial<ListInvoicesDto> = {}): ListInvoicesDto {
    return { page: 2, pageSize: 10, skip: 10, ...o } as ListInvoicesDto;
  }

  it('scopes by tenant and paginates', async () => {
    const { svc, client } = buildService();
    client.invoice.count.mockResolvedValue(11);
    client.invoice.findMany.mockResolvedValue([{ id: 'inv_1' }]);
    const res = await svc.list(actor, listDto());
    expect(res).toEqual({ items: [{ id: 'inv_1' }], total: 11, page: 2, pageSize: 10 });
    const args = client.invoice.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ tenantId: 'tenant_1' });
    expect(args.skip).toBe(10);
    expect(args.take).toBe(10);
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
  });

  it('applies status / customer / booking / q filters', async () => {
    const { svc, client } = buildService();
    client.invoice.count.mockResolvedValue(0);
    client.invoice.findMany.mockResolvedValue([]);
    await svc.list(
      actor,
      listDto({ status: InvoiceStatus.SENT, customerId: 'c', bookingId: 'b', q: 'INV-', minDueAmountMinor: 500 }),
    );
    const where = client.invoice.count.mock.calls[0][0].where;
    expect(where).toMatchObject({
      tenantId: 'tenant_1',
      status: InvoiceStatus.SENT,
      customerId: 'c',
      bookingId: 'b',
      dueAmountMinor: { gte: 500 },
    });
    expect(where.OR).toEqual([
      { number: { contains: 'INV-', mode: 'insensitive' } },
      { notes: { contains: 'INV-', mode: 'insensitive' } },
    ]);
  });

  it('overdueOnly overrides status and merges with minDueAmountMinor', async () => {
    const { svc, client } = buildService();
    client.invoice.count.mockResolvedValue(0);
    client.invoice.findMany.mockResolvedValue([]);
    await svc.list(actor, listDto({ overdueOnly: true, minDueAmountMinor: 100, status: InvoiceStatus.PAID }));
    const where = client.invoice.findMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID] });
    expect(where.dueAmountMinor).toEqual({ gte: 100, gt: 0 });
    expect(where.dueDate.lt).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
describe('InvoicesService.get', () => {
  it('returns the tenant-scoped invoice', async () => {
    const { svc, client } = buildService();
    client.invoice.findFirst.mockResolvedValue({ id: 'inv_1' });
    await expect(svc.get(actor, 'inv_1')).resolves.toEqual({ id: 'inv_1' });
    expect(client.invoice.findFirst.mock.calls[0][0].where).toEqual({ id: 'inv_1', tenantId: 'tenant_1' });
  });

  it('404s when missing', async () => {
    const { svc, client } = buildService();
    client.invoice.findFirst.mockResolvedValue(null);
    await expect(svc.get(actor, 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
describe('InvoicesService.update', () => {
  const stored = {
    id: 'inv_1',
    number: `INV-${YEAR}-000001`,
    status: InvoiceStatus.DRAFT,
    gstEnabled: true,
    placeOfSupply: null as string | null,
    discountMinor: 0,
    amountPaidMinor: 0,
    gstNumber: null,
    notes: 'old notes',
    terms: 'old terms',
    dueDate: null,
    lineItems: [
      { description: 'Existing', quantity: 1, unitPriceMinor: 10_000, discountMinor: 0, taxRateBps: 1800, hsnSacCode: null },
    ],
  };

  it('404s when the invoice is missing', async () => {
    const { svc, tx } = buildService();
    tx.invoice.findFirst.mockResolvedValue(null);
    await expect(svc.update(actor, 'inv_1', {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('only allows notes/dueDate once issued', async () => {
    const { svc, tx } = buildService();
    tx.invoice.findFirst.mockResolvedValue({ ...stored, status: InvoiceStatus.SENT });
    await svc.update(actor, 'inv_1', { notes: 'n', dueDate: '2026-12-31T00:00:00.000Z', discountMinor: 5 });
    const args = tx.invoice.update.mock.calls[0][0];
    expect(args.data).toEqual({ notes: 'n', dueDate: new Date('2026-12-31T00:00:00.000Z') });
    expect(tx.invoiceLineItem.deleteMany).not.toHaveBeenCalled();
  });

  it('403s when an issued invoice receives only locked fields', async () => {
    const { svc, tx } = buildService();
    tx.invoice.findFirst.mockResolvedValue({ ...stored, status: InvoiceStatus.PAID });
    await expect(svc.update(actor, 'inv_1', { discountMinor: 100 })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(tx.invoice.update).not.toHaveBeenCalled();
  });

  it('recomputes totals from stored lines when only the discount changes (DRAFT)', async () => {
    const { svc, tx } = buildService();
    tx.invoice.findFirst.mockResolvedValue(stored);
    await svc.update(actor, 'inv_1', { discountMinor: 1_800 });
    expect(tx.invoiceLineItem.deleteMany).not.toHaveBeenCalled();
    const { data } = tx.invoice.update.mock.calls[0][0];
    expect(data).toMatchObject({
      subtotalMinor: 10_000,
      taxMinor: 1_800,
      discountMinor: 1_800,
      totalMinor: 10_000,
      dueAmountMinor: 10_000,
      notes: 'old notes',
      terms: 'old terms',
    });
  });

  it('replaces line items and recomputes with the new place of supply (DRAFT)', async () => {
    const { svc, tx } = buildService();
    tx.invoice.findFirst.mockResolvedValue({ ...stored, amountPaidMinor: 500 });
    await svc.update(actor, 'inv_1', {
      placeOfSupply: HOME_STATE,
      lineItems: [{ description: 'New', quantity: 3, unitPriceMinor: 1_000, taxRateBps: 1200 }],
    });
    expect(tx.invoiceLineItem.deleteMany).toHaveBeenCalledWith({ where: { invoiceId: 'inv_1' } });
    const created = tx.invoiceLineItem.createMany.mock.calls[0][0].data;
    expect(created).toEqual([
      expect.objectContaining({ invoiceId: 'inv_1', subtotalMinor: 3_000, taxMinor: 360, cgstMinor: 180, sgstMinor: 180, igstMinor: 0, hsnSacCode: null, discountMinor: 0 }),
    ]);
    const { data } = tx.invoice.update.mock.calls[0][0];
    expect(data).toMatchObject({ totalMinor: 3_360, dueAmountMinor: 2_860, placeOfSupply: HOME_STATE });
  });
});

// ---------------------------------------------------------------------------
describe('InvoicesService.send', () => {
  const invoice = { id: 'inv_1', status: InvoiceStatus.DRAFT, customerId: 'cust_1', totalMinor: 11_800, number: 'INV-X' };

  it('404s when missing', async () => {
    const { svc, tx } = buildService();
    tx.invoice.findFirst.mockResolvedValue(null);
    await expect(svc.send(actor, 'inv_1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('409s when not DRAFT', async () => {
    const { svc, tx, ledger } = buildService();
    tx.invoice.findFirst.mockResolvedValue({ ...invoice, status: InvoiceStatus.SENT });
    await expect(svc.send(actor, 'inv_1')).rejects.toBeInstanceOf(ConflictException);
    expect(ledger.post).not.toHaveBeenCalled();
  });

  it('marks SENT, posts a DEBIT ledger entry inside the tx and emits InvoiceSent', async () => {
    const { svc, tx, ledger, events } = buildService();
    tx.invoice.findFirst.mockResolvedValue(invoice);
    const res = await svc.send(actor, 'inv_1');
    expect(res.status).toBe(InvoiceStatus.SENT);
    const data = tx.invoice.update.mock.calls[0][0].data;
    expect(data.issueDate).toBeInstanceOf(Date);
    expect(data.sentAt).toBeInstanceOf(Date);
    expect(ledger.post).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant_1',
        customerId: 'cust_1',
        entryType: LedgerEntryType.INVOICE,
        direction: LedgerEntryDirection.DEBIT,
        amountMinor: 11_800,
        invoiceId: 'inv_1',
        externalRef: 'invoice:inv_1:issued',
      }),
      tx,
    );
    expect(events.publish).toHaveBeenCalledWith(DomainEventName.InvoiceSent, { invoiceId: 'inv_1', customerId: 'cust_1' });
  });
});

// ---------------------------------------------------------------------------
describe('InvoicesService.cancel', () => {
  const invoice = {
    id: 'inv_1',
    number: 'INV-X',
    status: InvoiceStatus.SENT,
    customerId: 'cust_1',
    totalMinor: 11_800,
    amountPaidMinor: 0,
    notes: 'hello',
    lineItems: [],
  };

  it('404s when missing', async () => {
    const { svc, tx } = buildService();
    tx.invoice.findFirst.mockResolvedValue(null);
    await expect(svc.cancel(actor, 'inv_1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([InvoiceStatus.CANCELLED, InvoiceStatus.REFUNDED])('409s when already %s', async (status) => {
    const { svc, tx } = buildService();
    tx.invoice.findFirst.mockResolvedValue({ ...invoice, status });
    await expect(svc.cancel(actor, 'inv_1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('409s when payments have been received', async () => {
    const { svc, tx } = buildService();
    tx.invoice.findFirst.mockResolvedValue({ ...invoice, status: InvoiceStatus.PARTIALLY_PAID, amountPaidMinor: 1 });
    await expect(svc.cancel(actor, 'inv_1')).rejects.toThrow(/refund payments first/);
    expect(tx.invoice.update).not.toHaveBeenCalled();
  });

  it('cancels a SENT invoice, appends the reason and posts a reversing CREDIT', async () => {
    const { svc, tx, ledger, events } = buildService();
    tx.invoice.findFirst.mockResolvedValue(invoice);
    await svc.cancel(actor, 'inv_1', 'customer changed mind');
    const data = tx.invoice.update.mock.calls[0][0].data;
    expect(data).toMatchObject({
      status: InvoiceStatus.CANCELLED,
      dueAmountMinor: 0,
      notes: 'hello\n[Cancelled] customer changed mind',
    });
    expect(data.cancelledAt).toBeInstanceOf(Date);
    expect(ledger.post).toHaveBeenCalledWith(
      expect.objectContaining({
        entryType: LedgerEntryType.ADJUSTMENT,
        direction: LedgerEntryDirection.CREDIT,
        amountMinor: 11_800,
        externalRef: 'invoice:inv_1:cancel',
      }),
      tx,
    );
    expect(events.publish).toHaveBeenCalledWith(DomainEventName.InvoiceCancelled, { invoiceId: 'inv_1', reason: 'customer changed mind' });
  });

  it('cancels a DRAFT without a ledger entry and keeps notes when no reason given', async () => {
    const { svc, tx, ledger, events } = buildService();
    tx.invoice.findFirst.mockResolvedValue({ ...invoice, status: InvoiceStatus.DRAFT });
    await svc.cancel(actor, 'inv_1');
    expect(tx.invoice.update.mock.calls[0][0].data.notes).toBe('hello');
    expect(ledger.post).not.toHaveBeenCalled();
    expect(events.publish).toHaveBeenCalledWith(DomainEventName.InvoiceCancelled, { invoiceId: 'inv_1', reason: null });
  });

  it('formats the reason without a leading newline when there were no notes', async () => {
    const { svc, tx } = buildService();
    tx.invoice.findFirst.mockResolvedValue({ ...invoice, notes: null });
    await svc.cancel(actor, 'inv_1', 'dup');
    expect(tx.invoice.update.mock.calls[0][0].data.notes).toBe('[Cancelled] dup');
  });
});

// ---------------------------------------------------------------------------
describe('InvoicesService.applyPayment', () => {
  const open = {
    id: 'inv_1',
    status: InvoiceStatus.SENT,
    totalMinor: 10_000,
    amountPaidMinor: 0,
    dueAmountMinor: 10_000,
    customerId: 'cust_1',
    number: 'INV-X',
  };
  const input = { tenantId: 'tenant_1', amountMinor: 4_000, method: PaymentMethod.CASH };

  it('rejects non-positive amounts before opening a tx', async () => {
    const { svc, client } = buildService();
    await expect(svc.applyPayment('inv_1', { ...input, amountMinor: 0 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.applyPayment('inv_1', { ...input, amountMinor: -5 })).rejects.toBeInstanceOf(BadRequestException);
    expect(client.$transaction).not.toHaveBeenCalled();
  });

  it('rejects fractional amounts (raw Error from ensureInteger)', async () => {
    const { svc, client } = buildService();
    await expect(svc.applyPayment('inv_1', { ...input, amountMinor: 1.5 })).rejects.toThrow(/integer/);
    expect(client.$transaction).not.toHaveBeenCalled();
  });

  it('404s when invoice is missing (tenant-scoped lookup)', async () => {
    const { svc, tx } = buildService();
    tx.invoice.findFirst.mockResolvedValue(null);
    await expect(svc.applyPayment('inv_1', input)).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.invoice.findFirst.mock.calls[0][0].where).toEqual({ id: 'inv_1', tenantId: 'tenant_1' });
  });

  it.each([InvoiceStatus.CANCELLED, InvoiceStatus.REFUNDED])('409s on a closed (%s) invoice', async (status) => {
    const { svc, tx } = buildService();
    tx.invoice.findFirst.mockResolvedValue({ ...open, status });
    await expect(svc.applyPayment('inv_1', input)).rejects.toThrow('Cannot settle a closed invoice');
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it('partial payment → PARTIALLY_PAID, CREDIT ledger, partial event', async () => {
    const { svc, tx, ledger, events } = buildService();
    tx.invoice.findFirst.mockResolvedValue(open);
    const res = await svc.applyPayment('inv_1', { ...input, transactionId: 'txn_1', gatewayRef: 'gw_1' });

    const payment = tx.payment.create.mock.calls[0][0].data;
    expect(payment).toMatchObject({
      tenantId: 'tenant_1',
      invoiceId: 'inv_1',
      method: PaymentMethod.CASH,
      status: PaymentStatus.CAPTURED,
      amountMinor: 4_000,
      currency: 'INR',
      gatewayRef: 'gw_1',
      transactionId: 'txn_1',
    });
    expect(payment.capturedAt).toBeInstanceOf(Date);

    expect(tx.invoice.update.mock.calls[0][0].data).toEqual({
      amountPaidMinor: 4_000,
      dueAmountMinor: 6_000,
      status: InvoiceStatus.PARTIALLY_PAID,
      paidAt: null,
    });
    expect(res.status).toBe(InvoiceStatus.PARTIALLY_PAID);
    expect(ledger.post).toHaveBeenCalledWith(
      expect.objectContaining({
        entryType: LedgerEntryType.PAYMENT,
        direction: LedgerEntryDirection.CREDIT,
        amountMinor: 4_000,
        externalRef: 'payment:tx:txn_1',
      }),
      tx,
    );
    expect(events.publish).toHaveBeenCalledWith(DomainEventName.InvoicePartiallyPaid, {
      invoiceId: 'inv_1',
      amountPaidMinor: 4_000,
      dueAmountMinor: 6_000,
    });
  });

  it('settling the remaining balance → PAID with paidAt and InvoicePaid event', async () => {
    const { svc, tx, events } = buildService();
    tx.invoice.findFirst.mockResolvedValue({ ...open, status: InvoiceStatus.PARTIALLY_PAID, amountPaidMinor: 4_000, dueAmountMinor: 6_000 });
    const captured = new Date('2026-10-01T10:00:00.000Z');
    await svc.applyPayment('inv_1', { ...input, amountMinor: 6_000, capturedAt: captured });
    expect(tx.payment.create.mock.calls[0][0].data.capturedAt).toBe(captured);
    const data = tx.invoice.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ amountPaidMinor: 10_000, dueAmountMinor: 0, status: InvoiceStatus.PAID });
    expect(data.paidAt).toBeInstanceOf(Date);
    expect(events.publish).toHaveBeenCalledWith(DomainEventName.InvoicePaid, {
      invoiceId: 'inv_1',
      customerId: 'cust_1',
      paidAmountMinor: 10_000,
    });
  });

  it('caps an overpayment at the outstanding due amount', async () => {
    const { svc, tx, ledger } = buildService();
    tx.invoice.findFirst.mockResolvedValue({ ...open, amountPaidMinor: 7_000, dueAmountMinor: 3_000 });
    await svc.applyPayment('inv_1', { ...input, amountMinor: 50_000 });
    expect(tx.payment.create.mock.calls[0][0].data.amountMinor).toBe(3_000);
    expect(tx.invoice.update.mock.calls[0][0].data).toMatchObject({ amountPaidMinor: 10_000, dueAmountMinor: 0, status: InvoiceStatus.PAID });
    expect(ledger.post.mock.calls[0][0].amountMinor).toBe(3_000);
  });

  it('skips a duplicate transactionId without creating a payment', async () => {
    const { svc, tx, ledger, events } = buildService();
    tx.invoice.findFirst.mockResolvedValue(open);
    tx.payment.findUnique.mockResolvedValue({ id: 'pay_existing' });
    tx.invoice.findUniqueOrThrow.mockResolvedValue({ ...open, payments: [{ id: 'pay_existing' }] });
    const res = await svc.applyPayment('inv_1', { ...input, transactionId: 'txn_dup' });
    expect(tx.payment.findUnique).toHaveBeenCalledWith({ where: { transactionId: 'txn_dup' }, select: { id: true } });
    expect(res).toEqual({ ...open, payments: [{ id: 'pay_existing' }] });
    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(tx.invoice.update).not.toHaveBeenCalled();
    expect(ledger.post).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('does not check duplicates when no transactionId is given; falls back to a time-based ledger ref', async () => {
    const { svc, tx, ledger } = buildService();
    tx.invoice.findFirst.mockResolvedValue(open);
    await svc.applyPayment('inv_1', input);
    expect(tx.payment.findUnique).not.toHaveBeenCalled();
    expect(tx.payment.create.mock.calls[0][0].data).toMatchObject({ transactionId: null, gatewayRef: null });
    expect(ledger.post.mock.calls[0][0].externalRef).toMatch(/^payment:inv_1:\d+$/);
  });

  it('409s when the invoice has no outstanding balance (e.g. already PAID)', async () => {
    const { svc, tx } = buildService();
    tx.invoice.findFirst.mockResolvedValue({ ...open, status: InvoiceStatus.PAID, amountPaidMinor: 10_000, dueAmountMinor: 0 });
    await expect(svc.applyPayment('inv_1', input)).rejects.toThrow('Invoice has no outstanding balance');
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it('issues a DRAFT before applying captured money, so the DEBIT precedes the CREDIT', async () => {
    const { svc, tx, ledger } = buildService();
    tx.invoice.findFirst.mockResolvedValue({ ...open, status: InvoiceStatus.DRAFT });
    await svc.applyPayment('inv_1', input);

    expect(tx.invoice.update.mock.calls[0][0].data).toMatchObject({ status: InvoiceStatus.SENT });
    expect(tx.invoice.update.mock.calls[0][0].data.issueDate).toBeInstanceOf(Date);
    expect(ledger.post).toHaveBeenCalledTimes(2);
    expect(ledger.post.mock.calls[0][0]).toMatchObject({
      entryType: LedgerEntryType.INVOICE,
      direction: LedgerEntryDirection.DEBIT,
      amountMinor: 10_000,
      externalRef: 'invoice:inv_1:issued',
    });
    expect(ledger.post.mock.calls[1][0]).toMatchObject({
      entryType: LedgerEntryType.PAYMENT,
      direction: LedgerEntryDirection.CREDIT,
    });
    expect(tx.payment.create).toHaveBeenCalled();
  });

  it("rejects a DRAFT when onDraft is 'reject' and records nothing", async () => {
    const { svc, tx, ledger } = buildService();
    tx.invoice.findFirst.mockResolvedValue({ ...open, status: InvoiceStatus.DRAFT });
    await expect(svc.applyPayment('inv_1', { ...input, onDraft: 'reject' })).rejects.toThrow(/still a draft/);
    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(ledger.post).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
describe('InvoicesService.recordManualPayment', () => {
  it('delegates to applyPayment with the actor tenant and no transactionId', async () => {
    const { svc } = buildService();
    const spy = jest.spyOn(svc, 'applyPayment').mockResolvedValue({ id: 'inv_1' } as never);
    await svc.recordManualPayment(actor, 'inv_1', { amountMinor: 500, method: PaymentMethod.CASH } as never);
    expect(spy).toHaveBeenCalledWith('inv_1', {
      tenantId: 'tenant_1',
      amountMinor: 500,
      method: PaymentMethod.CASH,
      gatewayRef: null,
      idempotencyKey: expect.stringMatching(/^manual:user_1:inv_1:\d+$/),
      onDraft: 'reject',
    });
  });
});

// ---------------------------------------------------------------------------
describe('InvoicesService.refund', () => {
  const invoice = {
    id: 'inv_1',
    number: 'INV-X',
    status: InvoiceStatus.PAID,
    customerId: 'cust_1',
    currency: 'INR',
    totalMinor: 10_000,
    amountPaidMinor: 10_000,
    amountRefundedMinor: 0,
    dueAmountMinor: 0,
    payments: [
      { id: 'pay_1', amountMinor: 6_000 },
      { id: 'pay_2', amountMinor: 4_000 },
    ],
  };

  function setup(inv = invoice, alreadyRefunded: number | null = null, creditedMinor: number | null = null) {
    const ctx = buildService();
    ctx.tx.creditNote.aggregate.mockResolvedValue({ _sum: { amountMinor: creditedMinor } });
    ctx.tx.invoice.findFirst.mockResolvedValue(inv);
    ctx.tx.refund.aggregate.mockResolvedValue({ _sum: { amountMinor: alreadyRefunded } });
    ctx.tx.creditNote.findFirst.mockResolvedValue({ number: `CN-${YEAR}-000009` });
    ctx.tx.creditNote.create.mockImplementation(async ({ data }: { data: { number: string } }) => ({ id: 'cn_1', number: data.number }));
    ctx.tx.refund.create.mockResolvedValue({ id: 'ref_1' });
    return ctx;
  }

  it('404s when missing', async () => {
    const { svc, tx } = buildService();
    tx.invoice.findFirst.mockResolvedValue(null);
    await expect(svc.refund(actor, 'inv_1', { amountMinor: 1 })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('400s when there is no captured payment / unknown paymentId', async () => {
    const a = setup({ ...invoice, payments: [] });
    await expect(a.svc.refund(actor, 'inv_1', { amountMinor: 1 })).rejects.toBeInstanceOf(BadRequestException);
    const b = setup();
    await expect(b.svc.refund(actor, 'inv_1', { amountMinor: 1, paymentId: 'pay_x' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('400s when the refund exceeds what remains refundable on the payment', async () => {
    const { svc, tx } = setup(invoice, 5_500);
    await expect(svc.refund(actor, 'inv_1', { amountMinor: 501 })).rejects.toThrow(/exceeds remaining refundable/);
    expect(tx.refund.aggregate.mock.calls[0][0].where).toEqual({
      paymentId: 'pay_1',
      status: { in: [RefundStatus.COMPLETED, RefundStatus.PROCESSING] },
    });
    expect(tx.refund.create).not.toHaveBeenCalled();
  });

  it('partial refund with credit note keeps status, posts DEBIT and emits events', async () => {
    const { svc, tx, ledger, events } = setup(invoice, null, 2_000);
    const res = await svc.refund(actor, 'inv_1', { amountMinor: 2_000, reason: 'faulty part', paymentId: 'pay_2' });

    expect(tx.creditNote.create.mock.calls[0][0].data).toMatchObject({
      tenantId: 'tenant_1',
      number: `CN-${YEAR}-000010`,
      customerId: 'cust_1',
      invoiceId: 'inv_1',
      status: CreditNoteStatus.ISSUED,
      amountMinor: 2_000,
      currency: 'INR',
      reason: 'faulty part',
    });
    expect(tx.refund.create.mock.calls[0][0].data).toMatchObject({
      paymentId: 'pay_2',
      amountMinor: 2_000,
      status: RefundStatus.PROCESSING,
      requestedBy: 'user_1',
      creditNoteId: 'cn_1',
    });
    expect(tx.invoice.update.mock.calls[0][0].data).toEqual({
      amountRefundedMinor: 2_000,
      status: InvoiceStatus.PAID,
      dueAmountMinor: 0,
    });
    expect(ledger.post).toHaveBeenCalledWith(
      expect.objectContaining({
        entryType: LedgerEntryType.REFUND,
        direction: LedgerEntryDirection.DEBIT,
        amountMinor: 2_000,
        refundId: 'ref_1',
        creditNoteId: 'cn_1',
        externalRef: 'refund:ref_1',
      }),
      tx,
    );
    expect(events.publish).toHaveBeenCalledWith(DomainEventName.CreditNoteIssued, { creditNoteId: 'cn_1', customerId: 'cust_1', amountMinor: 2_000 });
    expect(events.publish).toHaveBeenCalledWith(DomainEventName.InvoiceRefunded, { invoiceId: 'inv_1', refundId: 'ref_1', amountMinor: 2_000 });
    expect(res.creditNote).toEqual({ id: 'cn_1', number: `CN-${YEAR}-000010` });
  });

  it('flips to REFUNDED once a fully paid invoice is refunded and credited in full', async () => {
    const { svc, tx } = setup({ ...invoice, amountRefundedMinor: 4_000 }, null, 10_000);
    await svc.refund(actor, 'inv_1', { amountMinor: 6_000 });
    expect(tx.invoice.update.mock.calls[0][0].data).toEqual({
      amountRefundedMinor: 10_000,
      status: InvoiceStatus.REFUNDED,
      dueAmountMinor: 0,
    });
  });

  it('keeps the unpaid remainder owed when a part-paid invoice is refunded in full', async () => {
    // ₹100 invoice, ₹40 paid, ₹40 refunded with a ₹40 credit note → ₹60 still due.
    const partPaid = {
      ...invoice,
      status: InvoiceStatus.PARTIALLY_PAID,
      amountPaidMinor: 4_000,
      dueAmountMinor: 6_000,
      payments: [{ id: 'pay_1', amountMinor: 4_000 }],
    };
    const { svc, tx } = setup(partPaid, null, 4_000);
    await svc.refund(actor, 'inv_1', { amountMinor: 4_000 });
    expect(tx.invoice.update.mock.calls[0][0].data).toEqual({
      amountRefundedMinor: 4_000,
      status: InvoiceStatus.SENT,
      dueAmountMinor: 6_000,
    });
  });

  it('skips the credit note when issueCreditNote=false', async () => {
    const { svc, tx, ledger, events } = setup();
    const res = await svc.refund(actor, 'inv_1', { amountMinor: 100, issueCreditNote: false });
    expect(tx.creditNote.create).not.toHaveBeenCalled();
    expect(tx.refund.create.mock.calls[0][0].data.creditNoteId).toBeNull();
    expect(ledger.post.mock.calls[0][0].creditNoteId).toBeNull();
    expect(events.publish).not.toHaveBeenCalledWith(DomainEventName.CreditNoteIssued, expect.anything());
    expect(res.creditNote).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe('refundedBalance', () => {
  const base = { totalMinor: 10_000, amountPaidMinor: 10_000, amountRefundedMinor: 0, creditedMinor: 0, status: InvoiceStatus.PAID };

  it('a refund without a credit note re-opens the refunded amount', () => {
    expect(refundedBalance({ ...base, amountRefundedMinor: 2_000 })).toEqual({ dueAmountMinor: 2_000, status: InvoiceStatus.PARTIALLY_PAID });
  });

  it('a credited partial refund stays PAID with nothing due', () => {
    expect(refundedBalance({ ...base, amountRefundedMinor: 2_000, creditedMinor: 2_000 })).toEqual({ dueAmountMinor: 0, status: InvoiceStatus.PAID });
  });

  it('is REFUNDED only when nothing is retained and nothing is owed', () => {
    expect(refundedBalance({ ...base, amountRefundedMinor: 10_000, creditedMinor: 10_000 })).toEqual({ dueAmountMinor: 0, status: InvoiceStatus.REFUNDED });
  });

  it('keeps an OVERDUE invoice overdue when its payment is refunded', () => {
    expect(
      refundedBalance({ ...base, amountPaidMinor: 3_000, amountRefundedMinor: 3_000, creditedMinor: 0, status: InvoiceStatus.OVERDUE }),
    ).toEqual({ dueAmountMinor: 10_000, status: InvoiceStatus.OVERDUE });
  });
});

// ---------------------------------------------------------------------------
describe('InvoicesService.duplicate', () => {
  it('re-creates from the source invoice fields', async () => {
    const { svc, client } = buildService();
    client.invoice.findFirst.mockResolvedValue({
      id: 'inv_src',
      customerId: 'cust_1',
      discountMinor: 100,
      gstEnabled: true,
      gstNumber: null,
      placeOfSupply: 'KA',
      notes: null,
      terms: 't',
      currency: 'INR',
      lineItems: [{ description: 'x', quantity: 2, unitPriceMinor: 300, discountMinor: 0, taxRateBps: 1800, hsnSacCode: null }],
    });
    const spy = jest.spyOn(svc, 'create').mockResolvedValue({ id: 'inv_new' } as never);
    await expect(svc.duplicate(actor, 'inv_src')).resolves.toEqual({ id: 'inv_new' });
    expect(spy).toHaveBeenCalledWith(actor, {
      customerId: 'cust_1',
      lineItems: [{ description: 'x', quantity: 2, unitPriceMinor: 300, discountMinor: 0, taxRateBps: 1800, hsnSacCode: undefined }],
      discountMinor: 100,
      gstEnabled: true,
      gstNumber: undefined,
      placeOfSupply: 'KA',
      notes: undefined,
      terms: 't',
      currency: 'INR',
    });
  });
});

// ---------------------------------------------------------------------------
describe('InvoicesService.renderPdf', () => {
  const base = {
    id: 'inv_1',
    number: 'INV-X',
    status: InvoiceStatus.SENT,
    issueDate: null,
    dueDate: null,
    currency: 'INR',
    subtotalMinor: 2_000,
    discountMinor: 0,
    taxMinor: 360,
    totalMinor: 2_360,
    amountPaidMinor: 0,
    dueAmountMinor: 2_360,
    notes: null,
    terms: null,
    placeOfSupply: 'KA',
    gstEnabled: true,
    gstNumber: null,
    customer: { fullName: 'Test Customer', email: 'test@example.com', phone: '+910000000000' },
    lineItems: [
      { description: 'a', quantity: 1, unitPriceMinor: 1_000, discountMinor: 0, taxRateBps: 1800, hsnSacCode: null, subtotalMinor: 1_000, taxMinor: 180, totalMinor: 1_180, cgstMinor: 90, sgstMinor: 90, igstMinor: 0 },
      { description: 'b', quantity: 1, unitPriceMinor: 1_000, discountMinor: 0, taxRateBps: 1800, hsnSacCode: null, subtotalMinor: 1_000, taxMinor: 180, totalMinor: 1_180, cgstMinor: 0, sgstMinor: 0, igstMinor: 180 },
    ],
  };

  it('aggregates GST components, builds a UPI QR and persists the pdf hash', async () => {
    const { svc, client, pdf } = buildService();
    client.invoice.findFirst.mockResolvedValue(base);
    pdf.invoice.mockResolvedValue({ hash: 'abc123', buffer: Buffer.from('') });
    const res = await svc.renderPdf(actor, 'inv_1');
    const payload = pdf.invoice.mock.calls[0][0];
    expect(payload.invoice).toMatchObject({ cgstMinor: 90, sgstMinor: 90, igstMinor: 180, totalMinor: 2_360 });
    expect(payload.customer).toEqual({ name: 'Test Customer', email: 'test@example.com', phone: '+910000000000', address: null, gstin: null });
    expect(payload.lines).toHaveLength(2);
    expect(payload.qrPayload).toBe('upi://pay?am=23.6&tr=INV-X');
    expect(client.invoice.update).toHaveBeenCalledWith({ where: { id: 'inv_1' }, data: { pdfHash: 'abc123' } });
    expect(res.hash).toBe('abc123');
  });

  it('omits the QR when nothing is due', async () => {
    const { svc, client, pdf } = buildService();
    client.invoice.findFirst.mockResolvedValue({ ...base, dueAmountMinor: 0 });
    pdf.invoice.mockResolvedValue({ hash: 'h' });
    await svc.renderPdf(actor, 'inv_1');
    expect(pdf.invoice.mock.calls[0][0].qrPayload).toBeNull();
  });
});

describe('InvoicesService.linkToken', () => {
  it('returns a 16-char base64url token that differs between calls', () => {
    const a = InvoicesService.linkToken();
    const b = InvoicesService.linkToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(a).not.toBe(b);
  });
});
