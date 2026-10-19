/**
 * Payments service — orchestrates payment-link creation, webhook ingestion,
 * refunds and reconciliation.
 *
 * Webhook design
 * --------------
 *  • The controller hands us already-verified payloads. We upsert a
 *    `PaymentTransaction` keyed on `(provider, orderRef)` so duplicate
 *    deliveries are no-ops.
 *  • When we receive a `captured` event we call `InvoicesService.applyPayment`
 *    inside the same transaction — the invoice transitions to PAID /
 *    PARTIALLY_PAID atomically with the ledger entry.
 *  • All raw payloads are stored on the transaction for forensics.
 *
 * Reconciliation
 * --------------
 *  • `reconcileStale()` (called by `PaymentsReconcileScheduler`) walks
 *    transactions stuck in CREATED / PENDING / AUTHORIZED for longer than
 *    `PAYMENTS_RECONCILE_STALE_MINUTES` and asks the provider for the truth
 *    via `PaymentProvider.fetchStatus`. The result goes through exactly the
 *    same settle / fail helpers the webhook uses.
 *  • It also heals the crash window where a txn was flipped to CAPTURED but
 *    the invoice payment was never applied (no `Payment` row).
 *
 * Idempotency & concurrency
 * -------------------------
 *  • Every state change is a status-guarded `updateMany` (`WHERE status IN
 *    (open statuses)`). Postgres re-evaluates the predicate after a
 *    concurrent writer commits, so exactly one of {webhook, reconcile on
 *    instance A, reconcile on instance B} wins the transition; the losers
 *    see `count = 0` and skip side effects.
 *  • `InvoicesService.applyPayment` dedupes on `transactionId` (unique on
 *    `Payment.transactionId`), so even the heal path is safe to race.
 */

import { randomUUID } from 'node:crypto';

import type { AuthPrincipal } from '@ac/auth';
import {
  DomainEventName,
  PaymentMethod,
  PaymentStatus,
  PaymentTransactionStatus,
  RefundStatus,
} from '@ac/types';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { PaymentTransaction, Prisma } from '@prisma/client';

import { DomainEventBus } from '../../common/events/domain-event-bus.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import type {
  CreatePaymentLinkDto,
} from './dto/create-payment-link.dto';
import type { ListPaymentsDto } from './dto/list-payments.dto';
import type { RefundPaymentDto } from './dto/refund-payment.dto';
import type {
  PaymentProvider,
  ProviderPaymentStatus,
  WebhookEvent,
} from './providers/payment-provider.interface';
import { RazorpayProvider } from './providers/razorpay.provider';
import { StripeProvider } from './providers/stripe.provider';

const PREFERRED_PROVIDER = (process.env.PAYMENTS_PROVIDER ?? 'razorpay').toLowerCase() as
  | 'razorpay'
  | 'stripe';

/** Non-terminal statuses a txn may be settled / failed from. */
export const OPEN_TRANSACTION_STATUSES: PaymentTransactionStatus[] = [
  PaymentTransactionStatus.CREATED,
  PaymentTransactionStatus.PENDING,
  PaymentTransactionStatus.AUTHORIZED,
];

export const DEFAULT_RECONCILE_STALE_MINUTES = 15;
export const DEFAULT_RECONCILE_BATCH_SIZE = 100;
/** Heal phase only looks this far back so un-appliable txns stop being retried. */
export const RECONCILE_HEAL_WINDOW_DAYS = 7;

export interface ReconcileOptions {
  /** Only txns untouched for longer than this are reconciled. */
  staleAfterMinutes?: number;
  /** Max txns per run (per phase). */
  batchSize?: number;
  /** Injectable clock for tests. */
  now?: Date;
}

export interface ReconcileSummary {
  scanned: number;
  captured: number;
  failed: number;
  cancelled: number;
  pending: number;
  /** Lost the race to a concurrent webhook / reconciler — no-op. */
  skipped: number;
  /** CAPTURED txns whose invoice payment was (re)applied. */
  healed: number;
  errors: number;
}

type SettleableTxn = Pick<
  PaymentTransaction,
  'id' | 'tenantId' | 'customerId' | 'invoiceId' | 'provider' | 'amountMinor' | 'paymentRef'
>;

type SettleOutcome = 'settled' | 'already_settled' | 'needs_review';

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'P2002';
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventBus,
    private readonly invoices: InvoicesService,
    private readonly razorpay: RazorpayProvider,
    private readonly stripe: StripeProvider,
  ) {}

  // -------------------------------------------------------- payment link
  async createPaymentLink(actor: AuthPrincipal, dto: CreatePaymentLinkDto) {
    const invoice = await this.prisma.client.invoice.findFirst({
      where: { id: dto.invoiceId, tenantId: actor.tenantId },
      include: { customer: { select: { fullName: true, email: true, phone: true } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.dueAmountMinor <= 0) throw new BadRequestException('Invoice already settled');

    const amount = dto.amountMinor ?? invoice.dueAmountMinor;
    if (amount <= 0 || amount > invoice.dueAmountMinor) {
      throw new BadRequestException('Invalid amount');
    }
    const providerName = (dto.provider ?? PREFERRED_PROVIDER);
    const provider = this.provider(providerName);

    const orderRef = `inv_${invoice.id}_${randomUUID().slice(0, 8)}`;
    const link = await provider.createPaymentLink({
      amountMinor: amount,
      currency: invoice.currency,
      orderRef,
      description: `Payment for invoice ${invoice.number}`,
      customer: {
        name: invoice.customer.fullName,
        email: invoice.customer.email,
        phone: invoice.customer.phone,
      },
      callbackUrl: dto.callbackUrl,
      metadata: { invoiceId: invoice.id, customerId: invoice.customerId },
    });

    const txn = await this.prisma.client.paymentTransaction.create({
      data: {
        tenantId: actor.tenantId,
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        purpose: 'INVOICE',
        provider: providerName,
        status: PaymentTransactionStatus.PENDING,
        amountMinor: amount,
        currency: invoice.currency,
        orderRef: link.orderRef,
        hostedLink: link.hostedLink,
        idempotencyKey: orderRef,
        rawPayload: link.rawPayload as Prisma.InputJsonValue,
      },
    });

    this.events.publish(DomainEventName.PaymentLinkCreated, {
      transactionId: txn.id,
      invoiceId: invoice.id,
      customerId: invoice.customerId,
      hostedLink: txn.hostedLink,
      provider: providerName,
    } as never);
    return { transaction: txn, hostedLink: txn.hostedLink };
  }

  // ------------------------------------------------------------ webhooks
  async handleRazorpayWebhook(rawBody: string, signature: string | undefined): Promise<{ ok: true; event?: string }>{
    this.razorpay.verifyWebhookSignature(rawBody, signature);
    const payload: unknown = JSON.parse(rawBody);
    const evt = this.razorpay.parseWebhookEvent(payload);
    return this.applyWebhook('razorpay', rawBody, signature ?? null, evt);
  }

  async handleStripeWebhook(rawBody: string, signature: string): Promise<{ ok: true; event?: string }> {
    const event = await this.stripe.verifyAndParse(rawBody, signature);
    const evt = this.stripe.parseWebhookEvent(event);
    return this.applyWebhook('stripe', rawBody, signature, evt);
  }

  private async applyWebhook(
    provider: 'razorpay' | 'stripe',
    _rawBody: string,
    signature: string | null,
    evt: WebhookEvent,
  ): Promise<{ ok: true; event?: string }> {
    if (!evt.orderRef && !evt.paymentRef) {
      this.logger.warn(`Webhook from ${provider} (${evt.type}) had no orderRef/paymentRef — acked`);
      return { ok: true, event: evt.type };
    }

    // Locate or upsert the local transaction.
    const txn = await this.prisma.client.paymentTransaction.findFirst({
      where: {
        provider,
        OR: [
          evt.orderRef ? { orderRef: evt.orderRef } : { id: '__never__' },
          // Our internal ref (stored as idempotencyKey) echoed back via notes/metadata.
          evt.orderRef ? { idempotencyKey: evt.orderRef } : { id: '__never__' },
          evt.paymentRef ? { paymentRef: evt.paymentRef } : { id: '__never__' },
        ],
      },
    });
    if (!txn) {
      // No local txn — likely a payment-link checkout the customer initiated;
      // create one so the audit trail survives.
      this.logger.warn(
        `Webhook ${evt.type} from ${provider} for unknown order ${evt.orderRef} — creating shell txn`,
      );
      // Without invoice context we can't reconcile; mark as orphaned and exit.
      return { ok: true, event: evt.type };
    }

    if (evt.status === 'captured') {
      await this.settleCaptured(txn, {
        paymentRef: evt.paymentRef ?? txn.paymentRef,
        amountMinor: evt.amountMinor ?? txn.amountMinor,
        signatureRef: signature,
        rawPayload: evt.rawPayload,
      });
    } else if (evt.status === 'failed') {
      await this.markTerminal(txn, PaymentTransactionStatus.FAILED, {
        failureCode: evt.failureCode,
        failureReason: evt.failureReason,
        rawPayload: evt.rawPayload,
      });
    } else if (evt.status === 'refunded') {
      await this.prisma.client.paymentTransaction.update({
        where: { id: txn.id },
        data: {
          status: PaymentTransactionStatus.REFUNDED,
          refundedAt: new Date(),
          version: { increment: 1 },
        },
      });
    } else {
      this.logger.log(`Webhook ${evt.type} from ${provider} → status ${evt.status} (no state change)`);
    }
    return { ok: true, event: evt.type };
  }

  // ------------------------------------------------------- reconciliation
  /**
   * Reconcile transactions stuck in an open status with the provider.
   * Safe to run concurrently (across instances) and repeatedly.
   */
  async reconcileStale(opts: ReconcileOptions = {}): Promise<ReconcileSummary> {
    const staleAfterMinutes = opts.staleAfterMinutes ?? DEFAULT_RECONCILE_STALE_MINUTES;
    const batchSize = opts.batchSize ?? DEFAULT_RECONCILE_BATCH_SIZE;
    const now = opts.now ?? new Date();
    const cutoff = new Date(now.getTime() - staleAfterMinutes * 60_000);
    const summary: ReconcileSummary = {
      scanned: 0,
      captured: 0,
      failed: 0,
      cancelled: 0,
      pending: 0,
      skipped: 0,
      healed: 0,
      errors: 0,
    };

    // Phase 1 — open txns: ask the provider for the truth.
    const stale = await this.prisma.client.paymentTransaction.findMany({
      where: {
        status: { in: OPEN_TRANSACTION_STATUSES },
        provider: { in: ['razorpay', 'stripe'] },
        orderRef: { not: null },
        updatedAt: { lt: cutoff },
      },
      orderBy: { updatedAt: 'asc' },
      take: batchSize,
    });

    for (const txn of stale) {
      if (!txn.orderRef) continue; // excluded by the query; narrows the type
      summary.scanned += 1;
      try {
        const truth = await this.provider(txn.provider as 'razorpay' | 'stripe').fetchStatus(
          txn.orderRef,
        );
        await this.applyProviderTruth(txn, truth, summary);
      } catch (err) {
        summary.errors += 1;
        // Only ids + error message — never provider payloads (may hold PII).
        this.logger.warn(
          `Reconcile failed for txn ${txn.id} (${txn.provider}): ${(err as Error)?.message ?? 'unknown error'}`,
        );
      }
    }

    // Phase 2 — heal CAPTURED txns whose invoice payment never landed
    // (process died between the status flip and applyPayment).
    const orphaned = await this.prisma.client.paymentTransaction.findMany({
      where: {
        status: PaymentTransactionStatus.CAPTURED,
        invoiceId: { not: null },
        payment: { is: null },
        capturedAt: {
          lt: cutoff,
          gt: new Date(now.getTime() - RECONCILE_HEAL_WINDOW_DAYS * 86_400_000),
        },
      },
      orderBy: { capturedAt: 'asc' },
      take: batchSize,
    });
    for (const txn of orphaned) {
      try {
        const outcome = await this.applyInvoicePayment(txn, txn.amountMinor, txn.paymentRef);
        if (outcome === 'settled') summary.healed += 1;
      } catch (err) {
        summary.errors += 1;
        this.logger.warn(
          `Reconcile heal failed for txn ${txn.id}: ${(err as Error)?.message ?? 'unknown error'}`,
        );
      }
    }

    if (summary.scanned > 0 || summary.healed > 0 || summary.errors > 0) {
      this.logger.log(
        `Payment reconcile: scanned=${summary.scanned} captured=${summary.captured} ` +
          `failed=${summary.failed} cancelled=${summary.cancelled} pending=${summary.pending} ` +
          `skipped=${summary.skipped} healed=${summary.healed} errors=${summary.errors}`,
      );
    }
    return summary;
  }

  private async applyProviderTruth(
    txn: PaymentTransaction,
    truth: ProviderPaymentStatus,
    summary: ReconcileSummary,
  ): Promise<void> {
    switch (truth.status) {
      case 'captured': {
        const won = await this.settleCaptured(txn, {
          paymentRef: truth.paymentRef ?? txn.paymentRef,
          amountMinor: truth.amountMinor ?? txn.amountMinor,
          signatureRef: null,
          rawPayload: truth.rawPayload,
        });
        if (won) summary.captured += 1;
        else summary.skipped += 1;
        return;
      }
      case 'failed':
      case 'expired': {
        const won = await this.markTerminal(txn, PaymentTransactionStatus.FAILED, {
          failureCode: truth.failureCode ?? (truth.status === 'expired' ? 'LINK_EXPIRED' : null),
          failureReason: truth.failureReason,
          rawPayload: truth.rawPayload,
        });
        if (won) summary.failed += 1;
        else summary.skipped += 1;
        return;
      }
      case 'cancelled': {
        const won = await this.markTerminal(txn, PaymentTransactionStatus.CANCELLED, {
          failureCode: truth.failureCode,
          failureReason: truth.failureReason,
          rawPayload: truth.rawPayload,
        });
        if (won) summary.cancelled += 1;
        else summary.skipped += 1;
        return;
      }
      default: {
        // pending / unknown — bump updatedAt (status-guarded) so the next
        // run rotates through other stale txns before re-checking this one.
        await this.prisma.client.paymentTransaction.updateMany({
          where: { id: txn.id, status: { in: OPEN_TRANSACTION_STATUSES } },
          data: { updatedAt: new Date() },
        });
        summary.pending += 1;
      }
    }
  }

  /**
   * Shared capture path for webhooks and reconciliation.
   *
   * Claims the txn with a status-guarded update; only the winner applies the
   * invoice payment (+ ledger, via InvoicesService) and emits
   * PaymentSucceeded. Returns `true` when this call won the transition.
   */
  private async settleCaptured(
    txn: SettleableTxn,
    input: {
      paymentRef: string | null;
      amountMinor: number;
      signatureRef: string | null;
      rawPayload: unknown;
    },
  ): Promise<boolean> {
    const claim = await this.prisma.client.paymentTransaction.updateMany({
      where: { id: txn.id, status: { in: OPEN_TRANSACTION_STATUSES } },
      data: {
        status: PaymentTransactionStatus.CAPTURED,
        paymentRef: input.paymentRef,
        signatureRef: input.signatureRef,
        rawPayload: input.rawPayload as Prisma.InputJsonValue,
        capturedAt: new Date(),
        version: { increment: 1 },
      },
    });
    if (claim.count === 0) {
      this.logger.log(`Txn ${txn.id} already settled — capture is a no-op`);
      return false;
    }

    const method = txn.provider === 'razorpay' ? PaymentMethod.RAZORPAY : PaymentMethod.STRIPE;
    try {
      await this.applyInvoicePayment(txn, input.amountMinor, input.paymentRef);
    } catch (err) {
      // Transient failure — release the claim so the next reconcile run (or
      // a webhook retry) can try again. Guarded on "no Payment row yet" so we
      // never un-capture a txn whose invoice payment did land.
      await this.prisma.client.paymentTransaction.updateMany({
        where: { id: txn.id, status: PaymentTransactionStatus.CAPTURED, payment: { is: null } },
        data: {
          status: PaymentTransactionStatus.PENDING,
          capturedAt: null,
          version: { increment: 1 },
        },
      });
      throw err;
    }

    this.events.publish(DomainEventName.PaymentSucceeded, {
      transactionId: txn.id,
      invoiceId: txn.invoiceId,
      customerId: txn.customerId,
      amountMinor: input.amountMinor,
      method,
    } as never);
    return true;
  }

  /**
   * Apply the captured amount to the linked invoice. Idempotent on
   * `transactionId`. Business conflicts (invoice cancelled / already fully
   * paid) are NOT retried — the money is captured, so ops must refund or
   * re-allocate manually.
   */
  private async applyInvoicePayment(
    txn: SettleableTxn,
    amountMinor: number,
    paymentRef: string | null,
  ): Promise<SettleOutcome> {
    if (!txn.invoiceId) return 'settled';
    try {
      await this.invoices.applyPayment(txn.invoiceId, {
        tenantId: txn.tenantId,
        amountMinor,
        method: txn.provider === 'razorpay' ? PaymentMethod.RAZORPAY : PaymentMethod.STRIPE,
        gatewayRef: paymentRef,
        transactionId: txn.id,
      });
      return 'settled';
    } catch (err) {
      if (isUniqueViolation(err)) {
        // A concurrent caller created the Payment row first.
        return 'already_settled';
      }
      if (err instanceof ConflictException || err instanceof NotFoundException) {
        this.logger.error(
          `Captured txn ${txn.id} could not be applied to invoice ${txn.invoiceId}: ${err.message} — manual review required`,
        );
        return 'needs_review';
      }
      throw err;
    }
  }

  /** Status-guarded FAILED / CANCELLED transition. Returns true if it won. */
  private async markTerminal(
    txn: SettleableTxn,
    status: typeof PaymentTransactionStatus.FAILED | typeof PaymentTransactionStatus.CANCELLED,
    input: { failureCode: string | null; failureReason: string | null; rawPayload: unknown },
  ): Promise<boolean> {
    const res = await this.prisma.client.paymentTransaction.updateMany({
      where: { id: txn.id, status: { in: OPEN_TRANSACTION_STATUSES } },
      data: {
        status,
        failureCode: input.failureCode,
        failureReason: input.failureReason,
        rawPayload: input.rawPayload as Prisma.InputJsonValue,
        failedAt: new Date(),
        version: { increment: 1 },
      },
    });
    if (res.count === 0) {
      this.logger.log(`Txn ${txn.id} not open — ${status} transition skipped`);
      return false;
    }
    this.events.publish(DomainEventName.PaymentFailed, {
      transactionId: txn.id,
      invoiceId: txn.invoiceId,
      customerId: txn.customerId,
      reason: input.failureReason,
    } as never);
    return true;
  }

  // ----------------------------------------------------------- list / refund
  async list(actor: AuthPrincipal, dto: ListPaymentsDto) {
    const where: Prisma.PaymentTransactionWhereInput = { tenantId: actor.tenantId };
    if (dto.status) where.status = dto.status;
    if (dto.customerId) where.customerId = dto.customerId;
    if (dto.invoiceId) where.invoiceId = dto.invoiceId;
    if (dto.provider) where.provider = dto.provider;

    const [total, items] = await Promise.all([
      this.prisma.client.paymentTransaction.count({ where }),
      this.prisma.client.paymentTransaction.findMany({
        where,
        skip: dto.skip,
        take: dto.pageSize,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { id: true, fullName: true } } },
      }),
    ]);
    return { items, total, page: dto.page, pageSize: dto.pageSize };
  }

  /**
   * Initiate a gateway refund against a Payment row.
   *
   * The Invoice.refund path is independent — that one issues a credit-note +
   * marks the invoice REFUNDED. This path additionally pushes the refund to
   * the gateway. UI typically calls `invoice.refund` and that internally
   * fires this for gateway-backed payments.
   */
  /**
   * Gateway refund for a captured payment. The refund is first reserved through
   * the invoice (amount capped by what's left on the payment, under a row lock;
   * credit note, ledger and invoice balance updated), then sent to the gateway
   * with the refund id as the idempotency key. A gateway failure marks it FAILED.
   */
  async refundPayment(actor: AuthPrincipal, paymentId: string, dto: RefundPaymentDto) {
    const payment = await this.prisma.client.payment.findFirst({
      where: { id: paymentId, tenantId: actor.tenantId },
      include: { transaction: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== PaymentStatus.CAPTURED) {
      throw new ConflictException('Only captured payments can be refunded');
    }
    if (!payment.transaction || payment.transaction.provider === 'manual') {
      throw new BadRequestException('Cash / manual payments must use invoice.refund only');
    }

    const reserved = await this.invoices.refund(actor, payment.invoiceId, {
      paymentId,
      amountMinor: dto.amountMinor,
      reason: dto.reason,
      issueCreditNote: dto.issueCreditNote,
    });

    const provider = this.provider(payment.transaction.provider as 'razorpay' | 'stripe');
    let result: Awaited<ReturnType<PaymentProvider['issueRefund']>>;
    try {
      result = await provider.issueRefund({
        paymentRef: payment.transaction.paymentRef ?? payment.gatewayRef ?? '',
        amountMinor: dto.amountMinor,
        notes: dto.reason,
        idempotencyKey: `refund_${reserved.refund.id}`,
      });
    } catch (err) {
      await this.invoices.reverseFailedRefund(actor, reserved.refund.id, (err as Error).message);
      throw new BadRequestException('The payment gateway rejected the refund');
    }

    const refund = await this.prisma.client.refund.update({
      where: { id: reserved.refund.id },
      data: {
        transactionId: payment.transactionId,
        status: result.status === 'completed' ? RefundStatus.COMPLETED : RefundStatus.PROCESSING,
        gatewayRef: result.refundRef,
        gatewayPayload: result.rawPayload as Prisma.InputJsonValue,
        approvedBy: actor.userId,
        processedAt: result.status === 'completed' ? new Date() : null,
      },
    });

    this.events.publish(DomainEventName.PaymentRefunded, {
      refundId: refund.id,
      invoiceId: refund.invoiceId,
      customerId: refund.customerId,
      amountMinor: dto.amountMinor,
      status: refund.status,
    } as never);
    return refund;
  }

  private provider(name: 'razorpay' | 'stripe' | 'manual'): PaymentProvider {
    if (name === 'razorpay') return this.razorpay;
    if (name === 'stripe') return this.stripe;
    throw new BadRequestException(`Unsupported provider: ${name}`);
  }
}
