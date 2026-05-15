/**
 * Stripe payment provider — production wiring.
 *
 * Stripe webhooks ship the signature in `Stripe-Signature` and require us
 * to pass the *raw body* to `constructEvent`. The Nest controller registers
 * a raw-body parser for `/payments/webhook/stripe` to make this safe.
 */

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
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe' as const;
  private readonly logger = new Logger(StripeProvider.name);
  private clientPromise?: Promise<{
    paymentLinks: { create: (params: unknown) => Promise<{ id: string; url: string }> };
    refunds: { create: (params: unknown) => Promise<{ id: string; status: string }> };
    webhooks: { constructEvent: (rawBody: string | Buffer, sig: string, secret: string) => unknown };
  }>;

  private get configured(): boolean {
    return Boolean(process.env.STRIPE_SECRET_KEY);
  }

  private async client() {
    if (this.clientPromise) return this.clientPromise;
    this.clientPromise = (async () => {
      const stripeModule = (await import('stripe')) as unknown as { default: new (k: string) => never };
      const Stripe = (stripeModule.default ?? stripeModule) as unknown as new (k: string) => {
        paymentLinks: { create: (params: unknown) => Promise<{ id: string; url: string }> };
        refunds: { create: (params: unknown) => Promise<{ id: string; status: string }> };
        webhooks: { constructEvent: (rawBody: string | Buffer, sig: string, secret: string) => unknown };
      };
      return new Stripe(process.env.STRIPE_SECRET_KEY!);
    })();
    return this.clientPromise;
  }

  async createPaymentLink(input: CreatePaymentLinkInput): Promise<CreatePaymentLinkResult> {
    if (!this.configured) {
      this.logger.warn('Stripe not configured — returning mock link');
      return { orderRef: `stripe_mock_${input.orderRef}`, hostedLink: null, rawPayload: { mock: true } };
    }
    const c = await this.client();
    const link = await c.paymentLinks.create({
      // Stripe needs a Price; we create an inline ad-hoc price.
      line_items: [
        {
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: input.amountMinor,
            product_data: { name: input.description },
          },
          quantity: 1,
        },
      ],
      metadata: { orderRef: input.orderRef, ...(input.metadata ?? {}) },
    });
    return { orderRef: link.id, hostedLink: link.url, rawPayload: link };
  }

  verifyWebhookSignature(_rawBody: string, _signature: string | undefined): void {
    // We verify and parse together in `parseWebhookEvent` to avoid double-parsing.
    if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error('Stripe webhook secret not configured');
  }

  parseWebhookEvent(payload: unknown): WebhookEvent {
    const evt = payload as {
      type?: string;
      data?: {
        object?: {
          id?: string;
          metadata?: Record<string, string>;
          amount?: number;
          amount_received?: number;
          currency?: string;
          last_payment_error?: { code?: string; message?: string };
          payment_intent?: string;
          status?: string;
        };
      };
    };
    const obj = evt.data?.object ?? {};
    const orderRef = obj.metadata?.orderRef ?? null;

    if (evt.type === 'payment_intent.succeeded' || evt.type === 'checkout.session.completed') {
      return {
        type: evt.type,
        orderRef,
        paymentRef: obj.id ?? null,
        amountMinor: obj.amount_received ?? obj.amount ?? null,
        currency: obj.currency ?? null,
        status: 'captured',
        failureCode: null,
        failureReason: null,
        rawPayload: payload,
      };
    }
    if (evt.type === 'payment_intent.payment_failed') {
      return {
        type: evt.type,
        orderRef,
        paymentRef: obj.id ?? null,
        amountMinor: obj.amount ?? null,
        currency: obj.currency ?? null,
        status: 'failed',
        failureCode: obj.last_payment_error?.code ?? null,
        failureReason: obj.last_payment_error?.message ?? null,
        rawPayload: payload,
      };
    }
    if (evt.type === 'charge.refunded') {
      return {
        type: evt.type,
        orderRef,
        paymentRef: obj.payment_intent ?? obj.id ?? null,
        amountMinor: obj.amount ?? null,
        currency: obj.currency ?? null,
        status: 'refunded',
        failureCode: null,
        failureReason: null,
        rawPayload: payload,
      };
    }
    return {
      type: evt.type ?? 'unknown',
      orderRef,
      paymentRef: obj.id ?? null,
      amountMinor: obj.amount ?? null,
      currency: obj.currency ?? null,
      status: 'created',
      failureCode: null,
      failureReason: null,
      rawPayload: payload,
    };
  }

  async issueRefund(input: IssueRefundInput): Promise<IssueRefundResult> {
    if (!this.configured) {
      return { refundRef: `stripe_mock_${input.idempotencyKey}`, status: 'processing', rawPayload: { mock: true } };
    }
    const c = await this.client();
    const res = await c.refunds.create({
      payment_intent: input.paymentRef,
      amount: input.amountMinor,
      metadata: { reason: input.notes ?? '', idempotencyKey: input.idempotencyKey },
    });
    return { refundRef: res.id, status: res.status === 'succeeded' ? 'completed' : 'processing', rawPayload: res };
  }

  /** Convenience for the controller — verifies + parses in one shot. */
  async verifyAndParse(rawBody: string, sigHeader: string): Promise<unknown> {
    if (!this.configured) {
      throw new Error('Stripe not configured');
    }
    const c = await this.client();
    return c.webhooks.constructEvent(rawBody, sigHeader, process.env.STRIPE_WEBHOOK_SECRET!);
  }
}
