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
  WebhookEvent,
} from './payment-provider.interface';

@Injectable()
export class RazorpayProvider implements PaymentProvider {
  readonly name = 'razorpay' as const;
  private readonly logger = new Logger(RazorpayProvider.name);
  private clientPromise?: Promise<{
    paymentLink: { create: (params: unknown) => Promise<{ id: string; short_url: string }> };
    payments: { refund: (paymentId: string, params: unknown) => Promise<{ id: string; status: string }> };
  }>;

  private get configured(): boolean {
    return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  }

  private async client() {
    if (this.clientPromise) return this.clientPromise;
    this.clientPromise = (async () => {
      const { default: Razorpay } = (await import('razorpay')) as unknown as {
        default: new (opts: { key_id: string; key_secret: string }) => {
          paymentLink: { create: (params: unknown) => Promise<{ id: string; short_url: string }> };
          payments: {
            refund: (paymentId: string, params: unknown) => Promise<{ id: string; status: string }>;
          };
        };
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
      notes: input.metadata,
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
        payment?: { entity?: { id?: string; order_id?: string; amount?: number; currency?: string; error_code?: string; error_description?: string; status?: string; notes?: Record<string, string> } };
        refund?: { entity?: { id?: string; payment_id?: string; amount?: number; status?: string } };
      };
    };
    const payment = evt.payload?.payment?.entity;
    const refund = evt.payload?.refund?.entity;

    if (evt.event === 'payment.captured') {
      return {
        type: 'payment.captured',
        orderRef: payment?.order_id ?? payment?.notes?.orderRef ?? null,
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
        orderRef: payment?.order_id ?? payment?.notes?.orderRef ?? null,
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
}
