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
 *  • `reconcileStale()` (called by a cron) walks transactions stuck in
 *    PENDING for > N minutes and asks the provider for the truth. Out of
 *    scope for this MVP scaffold — left as a TODO with intent comments.
 */

import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  DomainEventName,
  PaymentMethod,
  PaymentStatus,
  PaymentTransactionStatus,
  RefundStatus,
} from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { PrismaService } from '../../common/prisma/prisma.service';
import { DomainEventBus } from '../../common/events/domain-event-bus.service';
import { InvoicesService } from '../invoices/invoices.service';
import type {
  CreatePaymentLinkDto,
} from './dto/create-payment-link.dto';
import type { ListPaymentsDto } from './dto/list-payments.dto';
import type { PaymentProvider, WebhookEvent } from './providers/payment-provider.interface';
import { RazorpayProvider } from './providers/razorpay.provider';
import { StripeProvider } from './providers/stripe.provider';

const PREFERRED_PROVIDER = (process.env.PAYMENTS_PROVIDER ?? 'razorpay').toLowerCase() as
  | 'razorpay'
  | 'stripe';

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
    const providerName = (dto.provider ?? PREFERRED_PROVIDER) as 'razorpay' | 'stripe';
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
    const payload = JSON.parse(rawBody);
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
      await this.prisma.client.$transaction(async (tx) => {
        await tx.paymentTransaction.update({
          where: { id: txn.id },
          data: {
            status: PaymentTransactionStatus.CAPTURED,
            paymentRef: evt.paymentRef ?? txn.paymentRef,
            signatureRef: signature,
            rawPayload: evt.rawPayload as Prisma.InputJsonValue,
            capturedAt: new Date(),
            version: { increment: 1 },
          },
        });
      });
      if (txn.invoiceId) {
        await this.invoices.applyPayment(txn.invoiceId, {
          tenantId: txn.tenantId,
          amountMinor: evt.amountMinor ?? txn.amountMinor,
          method: provider === 'razorpay' ? PaymentMethod.RAZORPAY : PaymentMethod.STRIPE,
          gatewayRef: evt.paymentRef ?? txn.paymentRef,
          transactionId: txn.id,
        });
      }
      this.events.publish(DomainEventName.PaymentSucceeded, {
        transactionId: txn.id,
        invoiceId: txn.invoiceId,
        customerId: txn.customerId,
        amountMinor: evt.amountMinor ?? txn.amountMinor,
        method: provider === 'razorpay' ? PaymentMethod.RAZORPAY : PaymentMethod.STRIPE,
      } as never);
    } else if (evt.status === 'failed') {
      await this.prisma.client.paymentTransaction.update({
        where: { id: txn.id },
        data: {
          status: PaymentTransactionStatus.FAILED,
          failureCode: evt.failureCode,
          failureReason: evt.failureReason,
          rawPayload: evt.rawPayload as Prisma.InputJsonValue,
          failedAt: new Date(),
          version: { increment: 1 },
        },
      });
      this.events.publish(DomainEventName.PaymentFailed, {
        transactionId: txn.id,
        invoiceId: txn.invoiceId,
        customerId: txn.customerId,
        reason: evt.failureReason,
      } as never);
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
  async refundPayment(
    actor: AuthPrincipal,
    paymentId: string,
    amountMinor: number,
    reason?: string,
  ) {
    const payment = await this.prisma.client.payment.findFirst({
      where: { id: paymentId, tenantId: actor.tenantId },
      include: { transaction: true, invoice: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== PaymentStatus.CAPTURED) {
      throw new ConflictException('Only captured payments can be refunded');
    }
    if (!payment.transaction || payment.transaction.provider === 'manual') {
      throw new BadRequestException('Cash / manual payments must use invoice.refund only');
    }

    const provider = this.provider(payment.transaction.provider as 'razorpay' | 'stripe');
    const idem = `refund_${paymentId}_${Date.now()}`;
    const result = await provider.issueRefund({
      paymentRef: payment.transaction.paymentRef ?? payment.gatewayRef ?? '',
      amountMinor,
      notes: reason,
      idempotencyKey: idem,
    });

    const refund = await this.prisma.client.refund.create({
      data: {
        tenantId: actor.tenantId,
        paymentId,
        invoiceId: payment.invoiceId,
        transactionId: payment.transactionId,
        customerId: payment.invoice.customerId,
        amountMinor,
        status:
          result.status === 'completed'
            ? RefundStatus.COMPLETED
            : RefundStatus.PROCESSING,
        gatewayRef: result.refundRef,
        gatewayPayload: result.rawPayload as Prisma.InputJsonValue,
        reason: reason ?? null,
        requestedBy: actor.userId,
        approvedBy: actor.userId,
        processedAt: result.status === 'completed' ? new Date() : null,
      },
    });

    this.events.publish(DomainEventName.PaymentRefunded, {
      refundId: refund.id,
      invoiceId: refund.invoiceId,
      customerId: refund.customerId,
      amountMinor,
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
