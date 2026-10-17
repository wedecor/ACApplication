import { RazorpayProvider } from '../providers/razorpay.provider';
import { StripeProvider } from '../providers/stripe.provider';

describe('RazorpayProvider.parseWebhookEvent', () => {
  const provider = new RazorpayProvider();

  it('maps payment_link.paid to captured keyed on the payment link id', () => {
    const evt = provider.parseWebhookEvent({
      event: 'payment_link.paid',
      payload: {
        payment_link: { entity: { id: 'plink_abc', amount_paid: 49_900, currency: 'INR' } },
        payment: { entity: { id: 'pay_1', order_id: 'order_x', amount: 49_900, currency: 'INR' } },
      },
    });
    expect(evt).toMatchObject({
      type: 'payment_link.paid',
      orderRef: 'plink_abc',
      paymentRef: 'pay_1',
      amountMinor: 49_900,
      status: 'captured',
    });
  });

  it('prefers notes.orderRef over the Razorpay order id on payment events', () => {
    const evt = provider.parseWebhookEvent({
      event: 'payment.failed',
      payload: {
        payment: {
          entity: { id: 'pay_2', order_id: 'order_x', notes: { orderRef: 'inv_1_abcd' }, error_code: 'BAD' },
        },
      },
    });
    expect(evt).toMatchObject({ orderRef: 'inv_1_abcd', status: 'failed', failureCode: 'BAD' });
  });
});

describe('StripeProvider.parseWebhookEvent', () => {
  const provider = new StripeProvider();

  it('falls back to the payment_link id on checkout sessions without metadata', () => {
    const evt = provider.parseWebhookEvent({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', payment_link: 'plink_stripe', amount: 1000, currency: 'inr' } },
    });
    expect(evt).toMatchObject({ orderRef: 'plink_stripe', status: 'captured' });
  });

  it('uses metadata.orderRef from the payment intent when present', () => {
    const evt = provider.parseWebhookEvent({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_1', metadata: { orderRef: 'inv_9_ffff' }, amount_received: 500 } },
    });
    expect(evt).toMatchObject({ orderRef: 'inv_9_ffff', amountMinor: 500 });
  });
});
