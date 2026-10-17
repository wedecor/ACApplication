import { ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import {
  DomainEventName,
  PaymentMethod,
  PaymentTransactionStatus,
} from '@ac/types';

import {
  DEFAULT_RECONCILE_BATCH_SIZE,
  DEFAULT_RECONCILE_STALE_MINUTES,
  OPEN_TRANSACTION_STATUSES,
  PaymentsService,
} from '../payments.service';
import type {
  ProviderPaymentStatus,
  WebhookEvent,
} from '../providers/payment-provider.interface';

/**
 * Unit tests for PaymentsService webhook ingestion + stale reconciliation.
 *
 * Prisma, InvoicesService and both gateways are mocked. The status-guarded
 * `updateMany` is the concurrency primitive under test: `count: 1` means
 * this caller won the transition, `count: 0` means someone else did.
 */

type Txn = {
  id: string;
  tenantId: string;
  customerId: string;
  invoiceId: string | null;
  provider: string;
  status: string;
  amountMinor: number;
  orderRef: string | null;
  paymentRef: string | null;
  version: number;
};

function txn(overrides: Partial<Txn> = {}): Txn {
  return {
    id: 'txn_1',
    tenantId: 't',
    customerId: 'cust_1',
    invoiceId: 'inv_1',
    provider: 'razorpay',
    status: PaymentTransactionStatus.PENDING,
    amountMinor: 50_000,
    orderRef: 'plink_1',
    paymentRef: null,
    version: 0,
    ...overrides,
  };
}

function truth(overrides: Partial<ProviderPaymentStatus> = {}): ProviderPaymentStatus {
  return {
    status: 'pending',
    paymentRef: null,
    amountMinor: null,
    failureCode: null,
    failureReason: null,
    rawPayload: { source: 'reconcile' },
    ...overrides,
  };
}

function webhookEvent(overrides: Partial<WebhookEvent> = {}): WebhookEvent {
  return {
    type: 'payment.captured',
    orderRef: 'plink_1',
    paymentRef: 'pay_1',
    amountMinor: 50_000,
    currency: 'INR',
    status: 'captured',
    failureCode: null,
    failureReason: null,
    rawPayload: { event: 'payment.captured' },
    ...overrides,
  };
}

function buildService() {
  const prisma = {
    client: {
      paymentTransaction: {
        // Phase 1 (open txns) then phase 2 (orphaned captured) by default.
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
    },
  };
  const events = { publish: jest.fn() };
  const invoices = { applyPayment: jest.fn().mockResolvedValue({ id: 'inv_1' }) };
  const razorpay = {
    name: 'razorpay',
    fetchStatus: jest.fn(),
    verifyWebhookSignature: jest.fn(),
    parseWebhookEvent: jest.fn(),
  };
  const stripe = {
    name: 'stripe',
    fetchStatus: jest.fn(),
    verifyAndParse: jest.fn(),
    parseWebhookEvent: jest.fn(),
  };
  const service = new PaymentsService(
    prisma as never,
    events as never,
    invoices as never,
    razorpay as never,
    stripe as never,
  );
  const tm = prisma.client.paymentTransaction;
  /** Queue the two findMany phases: open txns, then orphaned captured txns. */
  const queue = (open: Txn[], orphaned: Txn[] = []) => {
    tm.findMany.mockResolvedValueOnce(open).mockResolvedValueOnce(orphaned);
  };
  return { service, prisma, tm, events, invoices, razorpay, stripe, queue };
}

const NOW = new Date('2026-10-16T12:00:00Z');

describe('PaymentsService.reconcileStale — query', () => {
  it('selects open, provider-backed txns older than the threshold, oldest first', async () => {
    const { service, tm } = buildService();
    await service.reconcileStale({ staleAfterMinutes: 30, batchSize: 25, now: NOW });

    const where = tm.findMany.mock.calls[0][0];
    expect(where.where.status).toEqual({ in: OPEN_TRANSACTION_STATUSES });
    expect(where.where.provider).toEqual({ in: ['razorpay', 'stripe'] });
    expect(where.where.orderRef).toEqual({ not: null });
    expect(where.where.updatedAt.lt).toEqual(new Date('2026-10-16T11:30:00Z'));
    expect(where.orderBy).toEqual({ updatedAt: 'asc' });
    expect(where.take).toBe(25);
  });

  it('uses the documented defaults when no options are passed', async () => {
    const { service, tm } = buildService();
    const before = Date.now();
    await service.reconcileStale();
    const arg = tm.findMany.mock.calls[0][0];
    expect(arg.take).toBe(DEFAULT_RECONCILE_BATCH_SIZE);
    const cutoff = (arg.where.updatedAt.lt as Date).getTime();
    expect(before - cutoff).toBeGreaterThanOrEqual(DEFAULT_RECONCILE_STALE_MINUTES * 60_000 - 1);
    expect(before - cutoff).toBeLessThan(DEFAULT_RECONCILE_STALE_MINUTES * 60_000 + 5_000);
  });

  it('only treats CREATED / PENDING / AUTHORIZED as open', () => {
    expect([...OPEN_TRANSACTION_STATUSES].sort()).toEqual(
      [
        PaymentTransactionStatus.AUTHORIZED,
        PaymentTransactionStatus.CREATED,
        PaymentTransactionStatus.PENDING,
      ].sort(),
    );
  });

  it('returns an all-zero summary when nothing is stale and does not call providers', async () => {
    const { service, razorpay, stripe } = buildService();
    const out = await service.reconcileStale({ now: NOW });
    expect(out).toEqual({
      scanned: 0,
      captured: 0,
      failed: 0,
      cancelled: 0,
      pending: 0,
      skipped: 0,
      healed: 0,
      errors: 0,
    });
    expect(razorpay.fetchStatus).not.toHaveBeenCalled();
    expect(stripe.fetchStatus).not.toHaveBeenCalled();
  });
});

describe('PaymentsService.reconcileStale — captured', () => {
  it('claims the txn with a status-guarded update, applies the invoice payment and emits PaymentSucceeded', async () => {
    const { service, tm, invoices, events, razorpay, queue } = buildService();
    queue([txn()]);
    razorpay.fetchStatus.mockResolvedValue(
      truth({ status: 'captured', paymentRef: 'pay_9', amountMinor: 50_000 }),
    );

    const out = await service.reconcileStale({ now: NOW });

    expect(razorpay.fetchStatus).toHaveBeenCalledWith('plink_1');
    const claim = tm.updateMany.mock.calls[0][0];
    expect(claim.where).toEqual({ id: 'txn_1', status: { in: OPEN_TRANSACTION_STATUSES } });
    expect(claim.data).toMatchObject({
      status: PaymentTransactionStatus.CAPTURED,
      paymentRef: 'pay_9',
      signatureRef: null,
      rawPayload: { source: 'reconcile' },
      version: { increment: 1 },
    });
    expect(claim.data.capturedAt).toBeInstanceOf(Date);

    expect(invoices.applyPayment).toHaveBeenCalledWith('inv_1', {
      tenantId: 't',
      amountMinor: 50_000,
      method: PaymentMethod.RAZORPAY,
      gatewayRef: 'pay_9',
      transactionId: 'txn_1',
    });
    expect(events.publish).toHaveBeenCalledWith(
      DomainEventName.PaymentSucceeded,
      expect.objectContaining({ transactionId: 'txn_1', invoiceId: 'inv_1', amountMinor: 50_000 }),
    );
    expect(out).toMatchObject({ scanned: 1, captured: 1, skipped: 0, errors: 0 });
  });

  it('routes stripe txns to the stripe gateway and records method STRIPE', async () => {
    const { service, invoices, razorpay, stripe, queue } = buildService();
    queue([txn({ provider: 'stripe', orderRef: 'plink_stripe' })]);
    stripe.fetchStatus.mockResolvedValue(
      truth({ status: 'captured', paymentRef: 'pi_1', amountMinor: 50_000 }),
    );
    await service.reconcileStale({ now: NOW });
    expect(stripe.fetchStatus).toHaveBeenCalledWith('plink_stripe');
    expect(razorpay.fetchStatus).not.toHaveBeenCalled();
    expect(invoices.applyPayment.mock.calls[0][1].method).toBe(PaymentMethod.STRIPE);
  });

  it('falls back to the txn amount / paymentRef when the provider omits them', async () => {
    const { service, invoices, razorpay, queue } = buildService();
    queue([txn({ paymentRef: 'pay_existing', amountMinor: 1234 })]);
    razorpay.fetchStatus.mockResolvedValue(truth({ status: 'captured' }));
    await service.reconcileStale({ now: NOW });
    expect(invoices.applyPayment).toHaveBeenCalledWith(
      'inv_1',
      expect.objectContaining({ amountMinor: 1234, gatewayRef: 'pay_existing' }),
    );
  });

  it('is a no-op when a concurrent webhook / reconciler already won the transition', async () => {
    const { service, tm, invoices, events, razorpay, queue } = buildService();
    queue([txn()]);
    razorpay.fetchStatus.mockResolvedValue(truth({ status: 'captured', paymentRef: 'pay_9' }));
    tm.updateMany.mockResolvedValueOnce({ count: 0 });

    const out = await service.reconcileStale({ now: NOW });

    expect(invoices.applyPayment).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
    expect(out).toMatchObject({ captured: 0, skipped: 1, errors: 0 });
  });

  it('does not call InvoicesService for txns without an invoice (e.g. ad-hoc links)', async () => {
    const { service, invoices, events, razorpay, queue } = buildService();
    queue([txn({ invoiceId: null })]);
    razorpay.fetchStatus.mockResolvedValue(truth({ status: 'captured', paymentRef: 'pay_9' }));
    const out = await service.reconcileStale({ now: NOW });
    expect(invoices.applyPayment).not.toHaveBeenCalled();
    expect(events.publish).toHaveBeenCalledWith(DomainEventName.PaymentSucceeded, expect.anything());
    expect(out.captured).toBe(1);
  });

  it('releases the claim (back to PENDING) and counts an error when applyPayment fails transiently', async () => {
    const { service, tm, invoices, events, razorpay, queue } = buildService();
    queue([txn()]);
    razorpay.fetchStatus.mockResolvedValue(truth({ status: 'captured', paymentRef: 'pay_9' }));
    invoices.applyPayment.mockRejectedValueOnce(new InternalServerErrorException('db blip'));

    const out = await service.reconcileStale({ now: NOW });

    expect(tm.updateMany).toHaveBeenCalledTimes(2);
    const release = tm.updateMany.mock.calls[1][0];
    expect(release.where).toEqual({
      id: 'txn_1',
      status: PaymentTransactionStatus.CAPTURED,
      payment: { is: null },
    });
    expect(release.data).toMatchObject({
      status: PaymentTransactionStatus.PENDING,
      capturedAt: null,
    });
    expect(events.publish).not.toHaveBeenCalled();
    expect(out).toMatchObject({ captured: 0, errors: 1 });
  });

  it('keeps the txn CAPTURED (manual review) when the invoice is closed / already settled', async () => {
    const { service, tm, invoices, razorpay, queue } = buildService();
    queue([txn()]);
    razorpay.fetchStatus.mockResolvedValue(truth({ status: 'captured', paymentRef: 'pay_9' }));
    invoices.applyPayment.mockRejectedValueOnce(new ConflictException('Cannot settle a closed invoice'));

    const out = await service.reconcileStale({ now: NOW });

    expect(tm.updateMany).toHaveBeenCalledTimes(1); // claim only, no release
    expect(out).toMatchObject({ captured: 1, errors: 0 });
  });

  it('treats a unique-violation from applyPayment as already applied (concurrent heal)', async () => {
    const { service, tm, invoices, razorpay, queue } = buildService();
    queue([txn()]);
    razorpay.fetchStatus.mockResolvedValue(truth({ status: 'captured', paymentRef: 'pay_9' }));
    invoices.applyPayment.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'P2002' }));

    const out = await service.reconcileStale({ now: NOW });

    expect(tm.updateMany).toHaveBeenCalledTimes(1);
    expect(out).toMatchObject({ captured: 1, errors: 0 });
  });
});

describe('PaymentsService.reconcileStale — failed / expired / cancelled / pending', () => {
  it.each([
    ['failed', PaymentTransactionStatus.FAILED, 'BAD_REQUEST_ERROR', 'failed'],
    ['expired', PaymentTransactionStatus.FAILED, 'LINK_EXPIRED', 'failed'],
  ] as const)(
    'marks %s links as %s with a status guard and emits PaymentFailed',
    async (providerStatus, expected, code, counter) => {
      const { service, tm, invoices, events, razorpay, queue } = buildService();
      queue([txn()]);
      razorpay.fetchStatus.mockResolvedValue(
        truth({
          status: providerStatus,
          failureCode: providerStatus === 'failed' ? code : null,
          failureReason: 'nope',
        }),
      );

      const out = await service.reconcileStale({ now: NOW });

      const call = tm.updateMany.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'txn_1', status: { in: OPEN_TRANSACTION_STATUSES } });
      expect(call.data).toMatchObject({ status: expected, failureCode: code, failureReason: 'nope' });
      expect(call.data.failedAt).toBeInstanceOf(Date);
      expect(invoices.applyPayment).not.toHaveBeenCalled();
      expect(events.publish).toHaveBeenCalledWith(
        DomainEventName.PaymentFailed,
        expect.objectContaining({ transactionId: 'txn_1', reason: 'nope' }),
      );
      expect(out[counter]).toBe(1);
    },
  );

  it('marks cancelled links CANCELLED', async () => {
    const { service, tm, razorpay, queue } = buildService();
    queue([txn()]);
    razorpay.fetchStatus.mockResolvedValue(
      truth({ status: 'cancelled', failureCode: 'LINK_CANCELLED' }),
    );
    const out = await service.reconcileStale({ now: NOW });
    expect(tm.updateMany.mock.calls[0][0].data.status).toBe(PaymentTransactionStatus.CANCELLED);
    expect(out.cancelled).toBe(1);
  });

  it('does not emit PaymentFailed when the txn was already settled concurrently', async () => {
    const { service, tm, events, razorpay, queue } = buildService();
    queue([txn()]);
    razorpay.fetchStatus.mockResolvedValue(truth({ status: 'expired' }));
    tm.updateMany.mockResolvedValueOnce({ count: 0 });
    const out = await service.reconcileStale({ now: NOW });
    expect(events.publish).not.toHaveBeenCalled();
    expect(out).toMatchObject({ failed: 0, skipped: 1 });
  });

  it.each(['pending', 'unknown'] as const)(
    'leaves %s txns open but bumps updatedAt (status-guarded) so the batch rotates',
    async (status) => {
      const { service, tm, events, invoices, razorpay, queue } = buildService();
      queue([txn()]);
      razorpay.fetchStatus.mockResolvedValue(truth({ status }));
      const out = await service.reconcileStale({ now: NOW });
      const call = tm.updateMany.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'txn_1', status: { in: OPEN_TRANSACTION_STATUSES } });
      expect(Object.keys(call.data)).toEqual(['updatedAt']);
      expect(events.publish).not.toHaveBeenCalled();
      expect(invoices.applyPayment).not.toHaveBeenCalled();
      expect(out.pending).toBe(1);
    },
  );

  it('isolates provider errors per txn and keeps processing the batch', async () => {
    const { service, razorpay, queue } = buildService();
    queue([txn({ id: 'txn_a' }), txn({ id: 'txn_b', orderRef: 'plink_2' })]);
    razorpay.fetchStatus
      .mockRejectedValueOnce(new Error('gateway timeout'))
      .mockResolvedValueOnce(truth({ status: 'captured', paymentRef: 'pay_b' }));
    const out = await service.reconcileStale({ now: NOW });
    expect(out).toMatchObject({ scanned: 2, captured: 1, errors: 1 });
  });

  it('never logs provider payloads (only ids / messages)', async () => {
    const { service, razorpay, queue } = buildService();
    const warn = jest.spyOn((service as unknown as { logger: { warn: (m: string) => void } }).logger, 'warn')
      .mockImplementation(() => undefined);
    queue([txn()]);
    razorpay.fetchStatus.mockRejectedValueOnce(
      Object.assign(new Error('boom'), { response: { card: '4111111111111111', token: 'tok_secret' } }),
    );
    await service.reconcileStale({ now: NOW });
    const logged = warn.mock.calls.map((c) => JSON.stringify(c)).join(' ');
    expect(logged).toContain('txn_1');
    expect(logged).not.toContain('4111111111111111');
    expect(logged).not.toContain('tok_secret');
  });

  it('is idempotent across runs: a second run after capture finds nothing to do', async () => {
    const { service, invoices, razorpay, queue } = buildService();
    queue([txn()]);
    razorpay.fetchStatus.mockResolvedValue(truth({ status: 'captured', paymentRef: 'pay_9' }));
    await service.reconcileStale({ now: NOW });
    // Second run: the txn is no longer open → findMany returns nothing.
    queue([]);
    const second = await service.reconcileStale({ now: NOW });
    expect(invoices.applyPayment).toHaveBeenCalledTimes(1);
    expect(second.scanned).toBe(0);
  });
});

describe('PaymentsService.reconcileStale — heal phase', () => {
  it('queries CAPTURED txns with an invoice but no Payment row, inside the heal window', async () => {
    const { service, tm } = buildService();
    await service.reconcileStale({ staleAfterMinutes: 15, now: NOW });
    const heal = tm.findMany.mock.calls[1][0];
    expect(heal.where).toMatchObject({
      status: PaymentTransactionStatus.CAPTURED,
      invoiceId: { not: null },
      payment: { is: null },
    });
    expect(heal.where.capturedAt.lt).toEqual(new Date('2026-10-16T11:45:00Z'));
    expect(heal.where.capturedAt.gt).toEqual(new Date('2026-10-09T12:00:00Z'));
  });

  it('re-applies the invoice payment for orphaned captured txns without re-claiming', async () => {
    const { service, tm, invoices, events, queue } = buildService();
    queue([], [txn({ status: PaymentTransactionStatus.CAPTURED, paymentRef: 'pay_x' })]);
    const out = await service.reconcileStale({ now: NOW });
    expect(tm.updateMany).not.toHaveBeenCalled();
    expect(invoices.applyPayment).toHaveBeenCalledWith(
      'inv_1',
      expect.objectContaining({ transactionId: 'txn_1', gatewayRef: 'pay_x', amountMinor: 50_000 }),
    );
    expect(events.publish).not.toHaveBeenCalled();
    expect(out.healed).toBe(1);
  });

  it('does not count a heal when another worker already created the Payment (P2002)', async () => {
    const { service, invoices, queue } = buildService();
    queue([], [txn({ status: PaymentTransactionStatus.CAPTURED })]);
    invoices.applyPayment.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'P2002' }));
    const out = await service.reconcileStale({ now: NOW });
    expect(out).toMatchObject({ healed: 0, errors: 0 });
  });

  it('counts an error and continues when a heal fails transiently', async () => {
    const { service, invoices, queue } = buildService();
    queue([], [txn({ id: 'a', status: 'CAPTURED' }), txn({ id: 'b', status: 'CAPTURED' })]);
    invoices.applyPayment.mockRejectedValueOnce(new Error('db down'));
    const out = await service.reconcileStale({ now: NOW });
    expect(out).toMatchObject({ healed: 1, errors: 1 });
  });

  it('does not count a heal for invoices needing manual review (not found / closed)', async () => {
    const { service, invoices, queue } = buildService();
    queue([], [txn({ status: 'CAPTURED' })]);
    invoices.applyPayment.mockRejectedValueOnce(new NotFoundException('Invoice not found'));
    const out = await service.reconcileStale({ now: NOW });
    expect(out).toMatchObject({ healed: 0, errors: 0 });
  });
});

describe('PaymentsService webhooks', () => {
  it('captured: settles via the shared guarded path and applies the invoice payment', async () => {
    const { service, tm, invoices, events, razorpay } = buildService();
    razorpay.parseWebhookEvent.mockReturnValue(webhookEvent());
    tm.findFirst.mockResolvedValue(txn());

    const res = await service.handleRazorpayWebhook('{"event":"payment.captured"}', 'sig_hex');

    expect(res).toEqual({ ok: true, event: 'payment.captured' });
    expect(razorpay.verifyWebhookSignature).toHaveBeenCalledWith('{"event":"payment.captured"}', 'sig_hex');
    expect(tm.findFirst.mock.calls[0][0].where).toEqual({
      provider: 'razorpay',
      OR: [{ orderRef: 'plink_1' }, { idempotencyKey: 'plink_1' }, { paymentRef: 'pay_1' }],
    });
    const claim = tm.updateMany.mock.calls[0][0];
    expect(claim.where.status).toEqual({ in: OPEN_TRANSACTION_STATUSES });
    expect(claim.data).toMatchObject({
      status: PaymentTransactionStatus.CAPTURED,
      paymentRef: 'pay_1',
      signatureRef: 'sig_hex',
    });
    expect(invoices.applyPayment).toHaveBeenCalledWith(
      'inv_1',
      expect.objectContaining({ amountMinor: 50_000, method: PaymentMethod.RAZORPAY, transactionId: 'txn_1' }),
    );
    expect(events.publish).toHaveBeenCalledWith(DomainEventName.PaymentSucceeded, expect.anything());
  });

  it('captured: duplicate delivery is a no-op (no second invoice application / event)', async () => {
    const { service, tm, invoices, events, razorpay } = buildService();
    razorpay.parseWebhookEvent.mockReturnValue(webhookEvent());
    tm.findFirst.mockResolvedValue(txn({ status: PaymentTransactionStatus.CAPTURED }));
    tm.updateMany.mockResolvedValueOnce({ count: 0 });

    await service.handleRazorpayWebhook('{}', 'sig');

    expect(invoices.applyPayment).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('captured: rethrows transient applyPayment failures so the gateway retries, after releasing the claim', async () => {
    const { service, tm, invoices, razorpay } = buildService();
    razorpay.parseWebhookEvent.mockReturnValue(webhookEvent());
    tm.findFirst.mockResolvedValue(txn());
    invoices.applyPayment.mockRejectedValueOnce(new InternalServerErrorException('db blip'));

    await expect(service.handleRazorpayWebhook('{}', 'sig')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(tm.updateMany.mock.calls[1][0].data.status).toBe(PaymentTransactionStatus.PENDING);
  });

  it('failed: marks FAILED via a status guard and emits PaymentFailed', async () => {
    const { service, tm, events, razorpay } = buildService();
    razorpay.parseWebhookEvent.mockReturnValue(
      webhookEvent({
        type: 'payment.failed',
        status: 'failed',
        failureCode: 'BAD_REQUEST_ERROR',
        failureReason: 'Card declined',
      }),
    );
    tm.findFirst.mockResolvedValue(txn());

    await service.handleRazorpayWebhook('{}', 'sig');

    const call = tm.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'txn_1', status: { in: OPEN_TRANSACTION_STATUSES } });
    expect(call.data).toMatchObject({
      status: PaymentTransactionStatus.FAILED,
      failureCode: 'BAD_REQUEST_ERROR',
      failureReason: 'Card declined',
    });
    expect(events.publish).toHaveBeenCalledWith(
      DomainEventName.PaymentFailed,
      expect.objectContaining({ reason: 'Card declined' }),
    );
  });

  it('failed: a late payment.failed cannot downgrade an already CAPTURED txn', async () => {
    const { service, tm, events, razorpay } = buildService();
    razorpay.parseWebhookEvent.mockReturnValue(webhookEvent({ type: 'payment.failed', status: 'failed' }));
    tm.findFirst.mockResolvedValue(txn({ status: PaymentTransactionStatus.CAPTURED }));
    tm.updateMany.mockResolvedValueOnce({ count: 0 });

    await service.handleRazorpayWebhook('{}', 'sig');

    expect(events.publish).not.toHaveBeenCalled();
  });

  it('refunded: flips the txn to REFUNDED', async () => {
    const { service, tm, razorpay } = buildService();
    razorpay.parseWebhookEvent.mockReturnValue(
      webhookEvent({ type: 'refund.processed', status: 'refunded', orderRef: null }),
    );
    tm.findFirst.mockResolvedValue(txn({ status: PaymentTransactionStatus.CAPTURED }));
    await service.handleRazorpayWebhook('{}', 'sig');
    expect(tm.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'txn_1' },
        data: expect.objectContaining({ status: PaymentTransactionStatus.REFUNDED }),
      }),
    );
  });

  it('acks events with no orderRef/paymentRef without touching the DB', async () => {
    const { service, tm, razorpay } = buildService();
    razorpay.parseWebhookEvent.mockReturnValue(webhookEvent({ orderRef: null, paymentRef: null }));
    const res = await service.handleRazorpayWebhook('{}', 'sig');
    expect(res.ok).toBe(true);
    expect(tm.findFirst).not.toHaveBeenCalled();
  });

  it('acks events for unknown orders without state changes', async () => {
    const { service, tm, invoices, razorpay } = buildService();
    razorpay.parseWebhookEvent.mockReturnValue(webhookEvent());
    tm.findFirst.mockResolvedValue(null);
    const res = await service.handleRazorpayWebhook('{}', 'sig');
    expect(res.ok).toBe(true);
    expect(tm.updateMany).not.toHaveBeenCalled();
    expect(invoices.applyPayment).not.toHaveBeenCalled();
  });

  it('acks non-actionable statuses (created / authorized) without state changes', async () => {
    const { service, tm, razorpay } = buildService();
    razorpay.parseWebhookEvent.mockReturnValue(webhookEvent({ type: 'payment.authorized', status: 'authorized' }));
    tm.findFirst.mockResolvedValue(txn());
    await service.handleRazorpayWebhook('{}', 'sig');
    expect(tm.updateMany).not.toHaveBeenCalled();
    expect(tm.update).not.toHaveBeenCalled();
  });

  it('propagates signature verification failures (nothing persisted)', async () => {
    const { service, tm, razorpay } = buildService();
    razorpay.verifyWebhookSignature.mockImplementation(() => {
      throw new Error('Invalid Razorpay webhook signature');
    });
    await expect(service.handleRazorpayWebhook('{}', 'bad')).rejects.toThrow(/Invalid Razorpay/);
    expect(tm.findFirst).not.toHaveBeenCalled();
  });

  it('stripe: verifies + parses then settles with method STRIPE', async () => {
    const { service, tm, invoices, stripe } = buildService();
    stripe.verifyAndParse.mockResolvedValue({ type: 'payment_intent.succeeded' });
    stripe.parseWebhookEvent.mockReturnValue(
      webhookEvent({ type: 'payment_intent.succeeded', paymentRef: 'pi_1' }),
    );
    tm.findFirst.mockResolvedValue(txn({ provider: 'stripe' }));

    const res = await service.handleStripeWebhook('{}', 'stripe_sig');

    expect(res.event).toBe('payment_intent.succeeded');
    expect(stripe.verifyAndParse).toHaveBeenCalledWith('{}', 'stripe_sig');
    expect(tm.findFirst.mock.calls[0][0].where.provider).toBe('stripe');
    expect(invoices.applyPayment.mock.calls[0][1].method).toBe(PaymentMethod.STRIPE);
  });
});
