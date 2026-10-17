import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import type { AuthPrincipal } from '@ac/auth';
import { DomainEventName, QuotationStatus } from '@ac/types';

import type { CreateQuotationDto } from '../dto/create-quotation.dto';
import type { ListQuotationsDto } from '../dto/list-quotations.dto';
import { QuotationsService } from '../quotations.service';

/**
 * Unit tests for QuotationsService with a fully mocked PrismaService.
 * `nextDocumentNumber` runs through `prisma.client.$transaction(fn)`, so the
 * QTN sequence lookup lands on `tx.quotation.findFirst`.
 */

const YEAR = new Date().getUTCFullYear();
const HOME_STATE = (process.env.GST_HOME_STATE ?? 'KA').toUpperCase();
const DAY_MS = 24 * 3600 * 1000;

const actor = { tenantId: 'tenant_1', userId: 'user_1' } as unknown as AuthPrincipal;

function model() {
  return {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };
}

function buildService() {
  const tx = {
    $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    quotation: model(),
  };
  const client = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    customer: model(),
    quotation: model(),
  };
  client.customer.findFirst.mockResolvedValue({ id: 'cust_1' });
  client.quotation.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'q_1',
    ...data,
    lineItems: (data.lineItems as { create: unknown[] }).create,
  }));
  client.quotation.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
    id: where.id,
    ...data,
  }));

  const prisma = { client };
  const events = { publish: jest.fn(), emit: jest.fn() };
  const invoices = { create: jest.fn().mockResolvedValue({ id: 'inv_9' }) };
  const pdf = { quotation: jest.fn(), invoice: jest.fn() };
  const svc = new QuotationsService(prisma as never, events as never, invoices as never, pdf as never);
  return { svc, client, tx, events, invoices, pdf };
}

function dto(o: Partial<CreateQuotationDto> = {}): CreateQuotationDto {
  return {
    customerId: 'cust_1',
    lineItems: [{ description: 'Split AC install', quantity: 1, unitPriceMinor: 100_000, taxRateBps: 1800 }],
    ...o,
  };
}

const future = () => new Date(Date.now() + DAY_MS);
const past = () => new Date(Date.now() - DAY_MS);

function stored(o: Record<string, unknown> = {}) {
  return {
    id: 'q_1',
    number: `QTN-${YEAR}-000001`,
    status: QuotationStatus.SENT,
    customerId: 'cust_1',
    bookingId: null as string | null,
    viewToken: 'vt_abc',
    expiresAt: future(),
    gstEnabled: true,
    notes: null as string | null,
    terms: null as string | null,
    currency: 'INR',
    subtotalMinor: 100_000,
    discountMinor: 0,
    taxMinor: 18_000,
    totalMinor: 118_000,
    customer: { fullName: 'Test Customer', email: 'test@example.com', phone: '+910000000000' },
    lineItems: [
      { description: 'Split AC install', quantity: 1, unitPriceMinor: 100_000, discountMinor: 0, taxRateBps: 1800, hsnSacCode: null as string | null, subtotalMinor: 100_000, taxMinor: 18_000, totalMinor: 118_000 },
    ],
    ...o,
  };
}

// ---------------------------------------------------------------------------
describe('QuotationsService.create', () => {
  it('404s when the customer is not in the tenant', async () => {
    const { svc, client } = buildService();
    client.customer.findFirst.mockResolvedValue(null);
    await expect(svc.create(actor, dto())).rejects.toBeInstanceOf(NotFoundException);
    expect(client.customer.findFirst.mock.calls[0][0].where).toEqual({ id: 'cust_1', tenantId: 'tenant_1' });
    expect(client.quotation.create).not.toHaveBeenCalled();
  });

  it('creates a DRAFT with computed totals, QTN number and a 7-day default expiry', async () => {
    const { svc, client, tx, events } = buildService();
    tx.quotation.findFirst.mockResolvedValue({ number: `QTN-${YEAR}-000007` });
    const before = Date.now();
    const q = await svc.create(
      actor,
      dto({
        leadId: 'lead_1',
        notes: 'n',
        lineItems: [
          { description: 'a', quantity: 2, unitPriceMinor: 25, taxRateBps: 1800, hsnSacCode: '9987' }, // 50 → 9
          { description: 'b', quantity: 1, unitPriceMinor: 25, taxRateBps: 1800, discountMinor: 0 }, // 25 → 4.5 → 4
        ],
      }),
    );
    const after = Date.now();
    const { data } = client.quotation.create.mock.calls[0][0];
    expect(data).toMatchObject({
      tenantId: 'tenant_1',
      number: `QTN-${YEAR}-000008`,
      customerId: 'cust_1',
      bookingId: null,
      leadId: 'lead_1',
      status: QuotationStatus.DRAFT,
      subtotalMinor: 75,
      taxMinor: 13,
      totalMinor: 88,
      gstEnabled: true,
      notes: 'n',
      terms: null,
    });
    expect(tx.quotation.findFirst.mock.calls[0][0].where).toEqual({
      tenantId: 'tenant_1',
      number: { startsWith: `QTN-${YEAR}-` },
    });
    const exp = (data.expiresAt as Date).getTime();
    expect(exp).toBeGreaterThanOrEqual(before + 7 * DAY_MS);
    expect(exp).toBeLessThanOrEqual(after + 7 * DAY_MS);
    expect(data.lineItems.create).toEqual([
      { description: 'a', quantity: 2, unitPriceMinor: 25, discountMinor: 0, taxRateBps: 1800, hsnSacCode: '9987', subtotalMinor: 50, taxMinor: 9, totalMinor: 59 },
      { description: 'b', quantity: 1, unitPriceMinor: 25, discountMinor: 0, taxRateBps: 1800, hsnSacCode: null, subtotalMinor: 25, taxMinor: 4, totalMinor: 29 },
    ]);
    expect(q.id).toBe('q_1');
    expect(events.publish).toHaveBeenCalledWith(DomainEventName.QuotationCreated, { quotationId: 'q_1', customerId: 'cust_1' });
  });

  it('honours an explicit expiresAt and gstEnabled=false', async () => {
    const { svc, client } = buildService();
    await svc.create(actor, dto({ expiresAt: '2026-12-31T00:00:00.000Z', gstEnabled: false, bookingId: 'bk_1' }));
    const { data } = client.quotation.create.mock.calls[0][0];
    expect(data.expiresAt).toEqual(new Date('2026-12-31T00:00:00.000Z'));
    expect(data).toMatchObject({ gstEnabled: false, taxMinor: 0, totalMinor: 100_000, bookingId: 'bk_1' });
  });

  it('computes the same tax total intra-state, but persists no place of supply / GST split', async () => {
    // NOTE: current behaviour — the Quotation model has no placeOfSupply or
    // cgst/sgst/igst columns, so the split is computed and then discarded.
    const { svc, client } = buildService();
    await svc.create(actor, dto({ placeOfSupply: HOME_STATE }));
    const { data } = client.quotation.create.mock.calls[0][0];
    expect(data.taxMinor).toBe(18_000);
    expect(data).not.toHaveProperty('placeOfSupply');
    expect(data.lineItems.create[0]).not.toHaveProperty('cgstMinor');
  });
});

// ---------------------------------------------------------------------------
describe('QuotationsService.list', () => {
  it('scopes by tenant, applies filters and paginates', async () => {
    const { svc, client } = buildService();
    client.quotation.count.mockResolvedValue(3);
    client.quotation.findMany.mockResolvedValue([{ id: 'q_1' }]);
    const res = await svc.list(actor, {
      page: 1,
      pageSize: 20,
      skip: 0,
      status: QuotationStatus.SENT,
      customerId: 'cust_1',
      q: 'QTN',
    } as unknown as ListQuotationsDto);
    expect(res).toEqual({ items: [{ id: 'q_1' }], total: 3, page: 1, pageSize: 20 });
    const args = client.quotation.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      tenantId: 'tenant_1',
      status: QuotationStatus.SENT,
      customerId: 'cust_1',
      OR: [{ number: { contains: 'QTN', mode: 'insensitive' } }],
    });
    expect(args).toMatchObject({ skip: 0, take: 20, orderBy: { createdAt: 'desc' } });
  });
});

// ---------------------------------------------------------------------------
describe('QuotationsService.get', () => {
  it('returns tenant-scoped quotation or 404s', async () => {
    const { svc, client } = buildService();
    client.quotation.findFirst.mockResolvedValueOnce(stored()).mockResolvedValueOnce(null);
    await expect(svc.get(actor, 'q_1')).resolves.toMatchObject({ id: 'q_1' });
    expect(client.quotation.findFirst.mock.calls[0][0].where).toEqual({ id: 'q_1', tenantId: 'tenant_1' });
    await expect(svc.get(actor, 'q_x')).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
describe('QuotationsService.send', () => {
  it('moves DRAFT → SENT and emits QuotationSent', async () => {
    const { svc, client, events } = buildService();
    client.quotation.findFirst.mockResolvedValue(stored({ status: QuotationStatus.DRAFT }));
    const res = await svc.send(actor, 'q_1');
    expect(res.status).toBe(QuotationStatus.SENT);
    const { data } = client.quotation.update.mock.calls[0][0];
    expect(data.sentAt).toBeInstanceOf(Date);
    expect(events.publish).toHaveBeenCalledWith(DomainEventName.QuotationSent, { quotationId: 'q_1', customerId: 'cust_1' });
  });

  it('409s when not DRAFT', async () => {
    const { svc, client } = buildService();
    client.quotation.findFirst.mockResolvedValue(stored({ status: QuotationStatus.SENT }));
    await expect(svc.send(actor, 'q_1')).rejects.toBeInstanceOf(ConflictException);
    expect(client.quotation.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
describe('QuotationsService.getByViewToken (public)', () => {
  it('404s for an unknown token', async () => {
    const { svc, client } = buildService();
    client.quotation.findFirst.mockResolvedValue(null);
    await expect(svc.getByViewToken('nope')).rejects.toBeInstanceOf(NotFoundException);
    expect(client.quotation.findFirst.mock.calls[0][0].where).toEqual({ viewToken: 'nope' });
  });

  it('bumps SENT → VIEWED and emits QuotationViewed', async () => {
    const { svc, client, events } = buildService();
    const q = stored({ status: QuotationStatus.SENT });
    client.quotation.findFirst.mockResolvedValue(q);
    const res = await svc.getByViewToken('vt_abc');
    const args = client.quotation.update.mock.calls[0][0];
    expect(args.where).toEqual({ id: 'q_1' });
    expect(args.data.status).toBe(QuotationStatus.VIEWED);
    expect(args.data.viewedAt).toBeInstanceOf(Date);
    expect(events.publish).toHaveBeenCalledWith(
      DomainEventName.QuotationViewed,
      expect.objectContaining({ quotationId: 'q_1', viewedAt: expect.any(String) }),
    );
    // NOTE: current behaviour — returns the pre-update row (status still SENT).
    expect(res.status).toBe(QuotationStatus.SENT);
  });

  it.each([QuotationStatus.DRAFT, QuotationStatus.VIEWED, QuotationStatus.APPROVED, QuotationStatus.EXPIRED])(
    'does not update when status is %s',
    async (status) => {
      const { svc, client, events } = buildService();
      client.quotation.findFirst.mockResolvedValue(stored({ status }));
      await svc.getByViewToken('vt_abc');
      expect(client.quotation.update).not.toHaveBeenCalled();
      expect(events.publish).not.toHaveBeenCalled();
    },
  );
});

// ---------------------------------------------------------------------------
describe('QuotationsService.customerApprove (public)', () => {
  it('404s for an unknown token', async () => {
    const { svc, client } = buildService();
    client.quotation.findFirst.mockResolvedValue(null);
    await expect(svc.customerApprove('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([QuotationStatus.REJECTED, QuotationStatus.EXPIRED, QuotationStatus.CONVERTED])(
    '409s when the quotation is terminal (%s)',
    async (status) => {
      const { svc, client } = buildService();
      client.quotation.findFirst.mockResolvedValue(stored({ status }));
      await expect(svc.customerApprove('vt_abc')).rejects.toBeInstanceOf(ConflictException);
      expect(client.quotation.update).not.toHaveBeenCalled();
    },
  );

  it('403s when past expiresAt even if not yet swept to EXPIRED', async () => {
    const { svc, client } = buildService();
    client.quotation.findFirst.mockResolvedValue(stored({ status: QuotationStatus.VIEWED, expiresAt: past() }));
    await expect(svc.customerApprove('vt_abc')).rejects.toBeInstanceOf(ForbiddenException);
    expect(client.quotation.update).not.toHaveBeenCalled();
  });

  it.each([QuotationStatus.SENT, QuotationStatus.VIEWED])('approves a %s quotation', async (status) => {
    const { svc, client, events } = buildService();
    client.quotation.findFirst.mockResolvedValue(stored({ status }));
    const res = await svc.customerApprove('vt_abc');
    expect(client.quotation.findFirst.mock.calls[0][0]).toEqual({ where: { viewToken: 'vt_abc' } });
    expect(res.status).toBe(QuotationStatus.APPROVED);
    expect(client.quotation.update.mock.calls[0][0].data.approvedAt).toBeInstanceOf(Date);
    expect(events.publish).toHaveBeenCalledWith(DomainEventName.QuotationApproved, { quotationId: 'q_1', customerId: 'cust_1' });
  });

  it('currently also approves a DRAFT (never sent) and re-approves an APPROVED quotation', async () => {
    // NOTE: current behaviour — only REJECTED/EXPIRED/CONVERTED are blocked.
    for (const status of [QuotationStatus.DRAFT, QuotationStatus.APPROVED]) {
      const { svc, client } = buildService();
      client.quotation.findFirst.mockResolvedValue(stored({ status }));
      await expect(svc.customerApprove('vt_abc')).resolves.toMatchObject({ status: QuotationStatus.APPROVED });
    }
  });
});

// ---------------------------------------------------------------------------
describe('QuotationsService.customerReject (public)', () => {
  it('404s for an unknown token', async () => {
    const { svc, client } = buildService();
    client.quotation.findFirst.mockResolvedValue(null);
    await expect(svc.customerReject('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('409s when terminal', async () => {
    const { svc, client } = buildService();
    client.quotation.findFirst.mockResolvedValue(stored({ status: QuotationStatus.CONVERTED }));
    await expect(svc.customerReject('vt_abc', 'too pricey')).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects with a reason and emits QuotationRejected', async () => {
    const { svc, client, events } = buildService();
    client.quotation.findFirst.mockResolvedValue(stored({ status: QuotationStatus.VIEWED }));
    const res = await svc.customerReject('vt_abc', 'too pricey');
    expect(res.status).toBe(QuotationStatus.REJECTED);
    const { data } = client.quotation.update.mock.calls[0][0];
    expect(data.rejectedReason).toBe('too pricey');
    expect(data.rejectedAt).toBeInstanceOf(Date);
    expect(events.publish).toHaveBeenCalledWith(DomainEventName.QuotationRejected, { quotationId: 'q_1', reason: 'too pricey' });
  });

  it('stores a null reason when omitted and does not check expiry', async () => {
    const { svc, client, events } = buildService();
    client.quotation.findFirst.mockResolvedValue(stored({ status: QuotationStatus.SENT, expiresAt: past() }));
    await svc.customerReject('vt_abc');
    expect(client.quotation.update.mock.calls[0][0].data.rejectedReason).toBeNull();
    expect(events.publish).toHaveBeenCalledWith(DomainEventName.QuotationRejected, { quotationId: 'q_1', reason: null });
  });
});

// ---------------------------------------------------------------------------
describe('QuotationsService.convertToInvoice', () => {
  it('404s when quotation is missing', async () => {
    const { svc, client } = buildService();
    client.quotation.findFirst.mockResolvedValue(null);
    await expect(svc.convertToInvoice(actor, 'q_1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('409s when already converted', async () => {
    const { svc, client, invoices } = buildService();
    client.quotation.findFirst.mockResolvedValue(stored({ status: QuotationStatus.CONVERTED }));
    await expect(svc.convertToInvoice(actor, 'q_1')).rejects.toBeInstanceOf(ConflictException);
    expect(invoices.create).not.toHaveBeenCalled();
  });

  it.each([QuotationStatus.DRAFT, QuotationStatus.SENT, QuotationStatus.REJECTED, QuotationStatus.EXPIRED])(
    '400s for %s quotations',
    async (status) => {
      const { svc, client, invoices } = buildService();
      client.quotation.findFirst.mockResolvedValue(stored({ status }));
      await expect(svc.convertToInvoice(actor, 'q_1')).rejects.toBeInstanceOf(BadRequestException);
      expect(invoices.create).not.toHaveBeenCalled();
    },
  );

  it.each([QuotationStatus.APPROVED, QuotationStatus.VIEWED])(
    'converts a %s quotation into an invoice and links them',
    async (status) => {
      const { svc, client, invoices, events } = buildService();
      client.quotation.findFirst.mockResolvedValue(
        stored({ status, bookingId: 'bk_1', notes: 'n', terms: 't', lineItems: [{ ...stored().lineItems[0], hsnSacCode: '9987' }] }),
      );
      const inv = await svc.convertToInvoice(actor, 'q_1');
      expect(inv).toEqual({ id: 'inv_9' });
      expect(invoices.create).toHaveBeenCalledWith(actor, {
        customerId: 'cust_1',
        bookingId: 'bk_1',
        lineItems: [{ description: 'Split AC install', quantity: 1, unitPriceMinor: 100_000, discountMinor: 0, taxRateBps: 1800, hsnSacCode: '9987' }],
        gstEnabled: true,
        notes: 'n',
        terms: 't',
      });
      const args = client.quotation.update.mock.calls[0][0];
      expect(args.where).toEqual({ id: 'q_1' });
      expect(args.data).toMatchObject({ status: QuotationStatus.CONVERTED, convertedInvoiceId: 'inv_9' });
      expect(args.data.convertedAt).toBeInstanceOf(Date);
      expect(events.publish).toHaveBeenCalledWith(DomainEventName.QuotationConverted, { quotationId: 'q_1', invoiceId: 'inv_9' });
    },
  );

  it('maps null optional fields to undefined and passes no placeOfSupply', async () => {
    const { svc, client, invoices } = buildService();
    client.quotation.findFirst.mockResolvedValue(stored({ status: QuotationStatus.APPROVED }));
    await svc.convertToInvoice(actor, 'q_1');
    const payload = invoices.create.mock.calls[0][1];
    expect(payload.bookingId).toBeUndefined();
    expect(payload.notes).toBeUndefined();
    expect(payload.terms).toBeUndefined();
    expect(payload.lineItems[0].hsnSacCode).toBeUndefined();
    expect(payload).not.toHaveProperty('placeOfSupply');
  });

  it('does not mark the quotation converted if invoice creation fails', async () => {
    const { svc, client, invoices, events } = buildService();
    client.quotation.findFirst.mockResolvedValue(stored({ status: QuotationStatus.APPROVED }));
    invoices.create.mockRejectedValue(new ConflictException('Booking already has invoice'));
    await expect(svc.convertToInvoice(actor, 'q_1')).rejects.toBeInstanceOf(ConflictException);
    expect(client.quotation.update).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('currently converts an APPROVED quotation even after expiresAt', async () => {
    const { svc, client, invoices } = buildService();
    client.quotation.findFirst.mockResolvedValue(stored({ status: QuotationStatus.APPROVED, expiresAt: past() }));
    await svc.convertToInvoice(actor, 'q_1');
    expect(invoices.create).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
describe('QuotationsService.expireOverdue', () => {
  it('expires SENT/VIEWED quotations past their deadline and returns the count', async () => {
    const { svc, client } = buildService();
    client.quotation.updateMany.mockResolvedValue({ count: 3 });
    const before = Date.now();
    await expect(svc.expireOverdue()).resolves.toBe(3);
    const args = client.quotation.updateMany.mock.calls[0][0];
    expect(args.where.status).toEqual({ in: [QuotationStatus.SENT, QuotationStatus.VIEWED] });
    expect(args.where.expiresAt.lt).toBeInstanceOf(Date);
    expect((args.where.expiresAt.lt as Date).getTime()).toBeGreaterThanOrEqual(before);
    expect(args.data).toEqual({ status: QuotationStatus.EXPIRED });
    // Not tenant-scoped: it is a global background sweep.
    expect(args.where).not.toHaveProperty('tenantId');
  });

  it('is a no-op returning 0 when nothing is stale', async () => {
    const { svc, client } = buildService();
    client.quotation.updateMany.mockResolvedValue({ count: 0 });
    await expect(svc.expireOverdue()).resolves.toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe('QuotationsService.renderPdf', () => {
  const OLD_ENV = process.env.WEB_BASE_URL;
  afterEach(() => {
    if (OLD_ENV === undefined) delete process.env.WEB_BASE_URL;
    else process.env.WEB_BASE_URL = OLD_ENV;
  });

  it('renders with customer + lines and a view-token QR link', async () => {
    process.env.WEB_BASE_URL = 'https://example.test';
    const { svc, client, pdf } = buildService();
    client.quotation.findFirst.mockResolvedValue(stored());
    pdf.quotation.mockResolvedValue({ hash: 'h' });
    await expect(svc.renderPdf(actor, 'q_1')).resolves.toEqual({ hash: 'h' });
    const payload = pdf.quotation.mock.calls[0][0];
    expect(payload.qrPayload).toBe('https://example.test/q/vt_abc');
    expect(payload.customer).toEqual({ name: 'Test Customer', email: 'test@example.com', phone: '+910000000000' });
    expect(payload.quotation).toMatchObject({ number: `QTN-${YEAR}-000001`, totalMinor: 118_000, currency: 'INR' });
    expect(payload.lines).toHaveLength(1);
  });

  it('falls back to the default web base URL', async () => {
    delete process.env.WEB_BASE_URL;
    const { svc, client, pdf } = buildService();
    client.quotation.findFirst.mockResolvedValue(stored());
    pdf.quotation.mockResolvedValue({ hash: 'h' });
    await svc.renderPdf(actor, 'q_1');
    expect(pdf.quotation.mock.calls[0][0].qrPayload).toBe('https://app.ac-platform.io/q/vt_abc');
  });
});
