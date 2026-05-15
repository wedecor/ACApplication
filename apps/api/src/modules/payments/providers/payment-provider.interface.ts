/**
 * Payment provider abstraction.
 *
 * Webhook handlers, payment-link creation and refund issuance ALL go
 * through this interface so the rest of the system never talks to
 * Razorpay/Stripe directly. Swapping providers (or adding a new one)
 * means dropping a new file under `providers/` and registering it in
 * `PaymentsModule`.
 */

export type PaymentProviderName = 'razorpay' | 'stripe' | 'manual';

export interface CreatePaymentLinkInput {
  amountMinor: number;
  currency: string;
  /** Local idempotency key (we'll add suffix per attempt if needed). */
  orderRef: string;
  description: string;
  customer: {
    name: string;
    email?: string | null;
    phone?: string | null;
  };
  callbackUrl?: string;
  metadata?: Record<string, string>;
}

export interface CreatePaymentLinkResult {
  /** Provider-side payment-link / order id. */
  orderRef: string;
  /** Hosted checkout / pay-link URL that we send to the customer. */
  hostedLink: string | null;
  rawPayload: unknown;
}

export interface WebhookEvent {
  /** "payment.captured", "payment_intent.succeeded", … */
  type: string;
  /** Provider-side ids that allow us to locate our local txn. */
  orderRef: string | null;
  paymentRef: string | null;
  amountMinor: number | null;
  currency: string | null;
  status: 'captured' | 'authorized' | 'failed' | 'refunded' | 'created' | 'cancelled';
  failureCode: string | null;
  failureReason: string | null;
  rawPayload: unknown;
}

export interface IssueRefundInput {
  paymentRef: string;
  amountMinor: number;
  notes?: string;
  idempotencyKey: string;
}

export interface IssueRefundResult {
  refundRef: string;
  status: 'processing' | 'completed' | 'failed';
  rawPayload: unknown;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  createPaymentLink(input: CreatePaymentLinkInput): Promise<CreatePaymentLinkResult>;
  /**
   * Verify a webhook signature given the raw body. Throw on invalid.
   * Implementations should be constant-time to avoid timing attacks.
   */
  verifyWebhookSignature(rawBody: string, signature: string | undefined): void;
  parseWebhookEvent(payload: unknown): WebhookEvent;
  issueRefund(input: IssueRefundInput): Promise<IssueRefundResult>;
}
