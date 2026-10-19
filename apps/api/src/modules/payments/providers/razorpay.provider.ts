/**
 * Razorpay payment provider — production wiring.
 *
 * Notes
 *  • We sign webhooks using HMAC-SHA256(rawBody, secret) and compare via
 *    `crypto.timingSafeEqual` to avoid timing attacks.
 *  • We rely on the `payment.captured` / `payment.failed` / `refund.processed`
 *    event subset; everything else is logged-and-acked.
 *  • The SDK is loaded lazily so dev environments without keys can still boot.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import type {
  CreatePaymentLinkInput,
  CreatePaymentLinkResult,
  IssueRefundInput,
  IssueRefundResult,
  PaymentProvider,
  ProviderPaymentStatus,
  WebhookEvent,
} from './payment-provider.interface';

/** Subset of the Razorpay payment-link entity we read during reconciliation. */
export interface RazorpayPaymentLinkEntity {
  id: string;
  /** created | partially_paid | paid | expired | cancelled */
  status: string;
  amount?: number;
  amount_paid?: number;
  payments?: { payment_id?: string; amount?: number; status?: string }[] | null;
}

interface RazorpayClient {
  paymentLink: {
    create: (params: unknown) => Promise<{ id: string; short_url: string }>;
    fetch: (id: string) => Promise<RazorpayPaymentLinkEntity>;
  };
  payments: { refund: (paymentId: string, params: unknown) => Promise<{ id: string; status: string }> };
}

/**
 * Map a Razorpay payment-link entity to our canonical status. Exported for
 * unit tests. Only ids / amounts / statuses are copied into `rawPayload` —
 * the link entity also carries customer contact details which we drop.
 */
export function mapRazorpayPaymentLink(link: RazorpayPaymentLinkEntity): ProviderPaymentStatus {
  const payments = (link.payments ?? []).map((p) => ({
    payment_id: p.payment_id ?? null,
    amount: p.amount ?? null,
    status: p.status ?? null,
  }));
  const rawPayload = {
    source: 'reconcile',
    provider: 'razorpay',
    id: link.id,
    status: link.status,
    amount: link.amount ?? null,
    amount_paid: link.amount_paid ?? null,
    payments,
  };
  const base = { paymentRef: null, amountMinor: null, failureCode: null, failureReason: null, rawPayload };

  switch (link.status) {
    case 'paid': {
      const captured = payments.filter((p) => p.status === 'captured');
      const last = captured[captured.length - 1] ?? payments[payments.length - 1];
      return {
        ...base,
        status: 'captured',
        paymentRef: last?.payment_id ?? null,
        amountMinor: link.amount_paid ?? link.amount ?? null,
      };
    }
    case 'expired':
      return { ...base, status: 'expired', failureCode: 'LINK_EXPIRED', failureReason: 'Payment link expired' };
    case 'cancelled':
      return { ...base, status: 'cancelled', failureCode: 'LINK_CANCELLED', failureReason: 'Payment link cancelled' };
    case 'created':
    case 'partially_paid':
      // Partial payments are not enabled on our links; if one shows up we
      // leave the txn pending rather than settling a partial amount.
      return { ...base, status: 'pending' };
    default:
      return { ...base, status: 'unknown' };
  }
}

@Injectable()
export class RazorpayProvider implements PaymentProvider {
  readonly name = 'razorpay' as const;
  private readonly logger = new Logger(RazorpayProvider.name);
  private clientPromise?: Promise<RazorpayClient>;

  private get configured(): boolean {
    return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  }

  private async client() {
    if (this.clientPromise) return this.clientPromise;
    this.clientPromise = (async () => {
      const { default: Razorpay } = (await import('razorpay')) as unknown as {
        default: new (opts: { key_id: string; key_secret: string }) => RazorpayClient;
      };
      return new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID!,
        key_secret: process.env.RAZORPAY_KEY_SECRET!,
      });
    })();
    return this.clientPromise;
  }

  async createPaymentLink(input: CreatePaymentLinkInput): Promise<CreatePaymentLinkResult> {
    if (!this.configured) {
      this.logger.warn('Razorpay not configured — returning mock link');
      return {
        orderRef: `mock_${input.orderRef}`,
        hostedLink: null,
        rawPayload: { mock: true },
      };
    }
    const c = await this.client();
    const link = await c.paymentLink.create({
      amount: input.amountMinor,
      currency: input.currency,
      description: input.description,
      reference_id: input.orderRef,
      customer: {
        name: input.customer.name,
        email: input.customer.email,
        contact: input.customer.phone,
      },
      notify: { sms: true, email: Boolean(input.customer.email) },
      callback_url: input.callbackUrl,
      callback_method: 'get',
      // Carry our internal ref so payment.* events can be matched back.
      notes: { ...(input.metadata ?? {}), orderRef: input.orderRef },
    });
    return { orderRef: link.id, hostedLink: link.short_url, rawPayload: link };
  }

  verifyWebhookSignature(rawBody: string, signature: string | undefined): void {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error('Razorpay webhook secret not configured');
    }
    if (!signature) throw new Error('Missing X-Razorpay-Signature header');
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const givenBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== givenBuf.length || !timingSafeEqual(expectedBuf, givenBuf)) {
      throw new Error('Invalid Razorpay webhook signature');
    }
  }

  parseWebhookEvent(payload: unknown): WebhookEvent {
    const evt = payload as {
      event?: string;
      payload?: {
        payment_link?: { entity?: { id?: string; amount_paid?: number; currency?: string } };
        payment?: { entity?: { id?: string; order_id?: string; amount?: number; currency?: string; error_code?: string; error_description?: string; status?: string; notes?: Record<string, string> } };
        refund?: { entity?: { id?: string; payment_id?: string; amount?: number; status?: string } };
      };
    };
    const payment = evt.payload?.payment?.entity;
    const refund = evt.payload?.refund?.entity;

    const paymentLink = evt.payload?.payment_link?.entity;

    // Payment-link checkouts: the link id is what we stored as orderRef.
    if (evt.event === 'payment_link.paid') {
      return {
        type: 'payment_link.paid',
        orderRef: paymentLink?.id ?? payment?.notes?.orderRef ?? null,
        paymentRef: payment?.id ?? null,
        amountMinor: payment?.amount ?? paymentLink?.amount_paid ?? null,
        currency: payment?.currency ?? paymentLink?.currency ?? null,
        status: 'captured',
        failureCode: null,
        failureReason: null,
        rawPayload: payload,
      };
    }
    if (evt.event === 'payment.captured') {
      return {
        type: 'payment.captured',
        orderRef: payment?.notes?.orderRef ?? payment?.order_id ?? null,
        paymentRef: payment?.id ?? null,
        amountMinor: payment?.amount ?? null,
        currency: payment?.currency ?? null,
        status: 'captured',
        failureCode: null,
        failureReason: null,
        rawPayload: payload,
      };
    }
    if (evt.event === 'payment.failed') {
      return {
        type: 'payment.failed',
        orderRef: payment?.notes?.orderRef ?? payment?.order_id ?? null,
        paymentRef: payment?.id ?? null,
        amountMinor: payment?.amount ?? null,
        currency: payment?.currency ?? null,
        status: 'failed',
        failureCode: payment?.error_code ?? null,
        failureReason: payment?.error_description ?? null,
        rawPayload: payload,
      };
    }
    if (evt.event === 'refund.processed' || evt.event === 'refund.created') {
      return {
        type: evt.event,
        orderRef: null,
        paymentRef: refund?.payment_id ?? null,
        amountMinor: refund?.amount ?? null,
        currency: null,
        status: refund?.status === 'processed' ? 'refunded' : 'created',
        failureCode: null,
        failureReason: null,
        rawPayload: payload,
      };
    }
    // Best-effort default — caller will see it as unknown and ack it.
    return {
      type: evt.event ?? 'unknown',
      orderRef: payment?.order_id ?? null,
      paymentRef: payment?.id ?? null,
      amountMinor: payment?.amount ?? null,
      currency: payment?.currency ?? null,
      status: 'created',
      failureCode: null,
      failureReason: null,
      rawPayload: payload,
    };
  }

  async issueRefund(input: IssueRefundInput): Promise<IssueRefundResult> {
    if (!this.configured) {
      return { refundRef: `mock_${input.idempotencyKey}`, status: 'processing', rawPayload: { mock: true } };
    }
    const c = await this.client();
    const res = await c.payments.refund(input.paymentRef, {
      amount: input.amountMinor,
      notes: { reason: input.notes ?? '' },
      receipt: input.idempotencyKey,
    });
    return {
      refundRef: res.id,
      status: res.status === 'processed' ? 'completed' : 'processing',
      rawPayload: res,
    };
  }

  async fetchStatus(orderRef: string): Promise<ProviderPaymentStatus> {
    if (!this.configured || orderRef.startsWith('mock_')) {
      return {
        status: 'unknown',
        paymentRef: null,
        amountMinor: null,
        failureCode: null,
        failureReason: null,
        rawPayload: { source: 'reconcile', provider: 'razorpay', mock: true },
      };
    }
    const c = await this.client();
    const link = await c.paymentLink.fetch(orderRef);
    return mapRazorpayPaymentLink(link);
  }
}
