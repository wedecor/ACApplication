import { createHmac } from 'node:crypto';

import { RazorpayProvider } from '../providers/razorpay.provider';

describe('RazorpayProvider.verifyWebhookSignature', () => {
  const SECRET = 'whsec_test_secret';
  const PAYLOAD = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_X' } } } });
  let provider: RazorpayProvider;

  beforeEach(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
    provider = new RazorpayProvider();
  });

  afterEach(() => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
  });

  it('accepts a correctly signed payload', () => {
    const sig = createHmac('sha256', SECRET).update(PAYLOAD).digest('hex');
    expect(() => provider.verifyWebhookSignature(PAYLOAD, sig)).not.toThrow();
  });

  it('rejects an invalid signature', () => {
    const sig = createHmac('sha256', 'wrong-secret').update(PAYLOAD).digest('hex');
    expect(() => provider.verifyWebhookSignature(PAYLOAD, sig)).toThrow(
      /Invalid Razorpay webhook signature/,
    );
  });

  it('rejects a missing signature header', () => {
    expect(() => provider.verifyWebhookSignature(PAYLOAD, undefined)).toThrow(
      /Missing X-Razorpay-Signature/,
    );
  });

  it('throws when secret is not configured', () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    const sig = createHmac('sha256', SECRET).update(PAYLOAD).digest('hex');
    expect(() => provider.verifyWebhookSignature(PAYLOAD, sig)).toThrow(
      /webhook secret not configured/,
    );
  });

  it('parses payment.captured event into the canonical WebhookEvent shape', () => {
    const event = provider.parseWebhookEvent({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_abc',
            order_id: 'order_xyz',
            amount: 12345,
            currency: 'INR',
          },
        },
      },
    });
    expect(event.type).toBe('payment.captured');
    expect(event.paymentRef).toBe('pay_abc');
    expect(event.orderRef).toBe('order_xyz');
    expect(event.amountMinor).toBe(12345);
    expect(event.status).toBe('captured');
  });

  it('parses payment.failed event with failure reason', () => {
    const event = provider.parseWebhookEvent({
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: 'pay_fail',
            order_id: 'order_xyz',
            error_code: 'BAD_REQUEST_ERROR',
            error_description: 'Card declined',
          },
        },
      },
    });
    expect(event.type).toBe('payment.failed');
    expect(event.failureReason).toBe('Card declined');
    expect(event.status).toBe('failed');
  });
});
