import { createHmac, timingSafeEqual } from 'node:crypto';

import type { Money } from '@ac/types';

export interface CreatePaymentOrderInput {
  amount: Money;
  /** Internal invoice id — round-trips back via webhooks. */
  receipt: string;
  notes?: Record<string, string>;
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

export interface PaymentOrder {
  /** Gateway order id used by the client SDK. */
  id: string;
  amount: Money;
  /** Gateway-specific status enum, normalized upstream. */
  status: 'created' | 'attempted' | 'paid';
  provider: 'razorpay' | 'stripe';
}

export interface VerifyWebhookInput {
  rawBody: string;
  signature: string;
  secret: string;
}

/**
 * Common interface every payment provider implements.
 */
export interface PaymentProvider {
  readonly name: 'razorpay' | 'stripe';
  createOrder(input: CreatePaymentOrderInput): Promise<PaymentOrder>;
  verifyWebhook(input: VerifyWebhookInput): boolean;
}

/**
 * Razorpay implementation — provider-specific code is intentionally minimal;
 * full client wired in `apps/api/src/modules/payments`.
 */
export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
}

export class RazorpayProvider implements PaymentProvider {
  readonly name = 'razorpay';
  readonly config: RazorpayConfig;

  constructor(config: RazorpayConfig) {
    this.config = config;
  }

  createOrder(_input: CreatePaymentOrderInput): Promise<PaymentOrder> {
    throw new Error('RazorpayProvider.createOrder not yet implemented');
  }

  /**
   * Razorpay webhook signature is HMAC-SHA256 of the raw body with the
   * dashboard-configured webhook secret.
   */
  verifyWebhook({ rawBody, signature, secret }: VerifyWebhookInput): boolean {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}

/** Stripe provider stub — to be filled in when international payments go live. */
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe';
  readonly secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  createOrder(_input: CreatePaymentOrderInput): Promise<PaymentOrder> {
    throw new Error('StripeProvider.createOrder not yet implemented');
  }

  verifyWebhook(_input: VerifyWebhookInput): boolean {
    throw new Error('StripeProvider.verifyWebhook not yet implemented');
  }
}
