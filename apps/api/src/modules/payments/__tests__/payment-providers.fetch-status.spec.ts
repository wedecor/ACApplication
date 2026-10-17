import { mapRazorpayPaymentLink, RazorpayProvider } from '../providers/razorpay.provider';
import { mapStripePaymentLink, StripeProvider } from '../providers/stripe.provider';

describe('mapRazorpayPaymentLink', () => {
  const link = {
    id: 'plink_1',
    amount: 50_000,
    amount_paid: 0,
    payments: null,
  };

  it('maps paid → captured using the last captured payment id and amount_paid', () => {
    const out = mapRazorpayPaymentLink({
      ...link,
      status: 'paid',
      amount_paid: 50_000,
      payments: [
        { payment_id: 'pay_failed', amount: 50_000, status: 'failed' },
        { payment_id: 'pay_ok', amount: 50_000, status: 'captured' },
      ],
    });
    expect(out).toMatchObject({ status: 'captured', paymentRef: 'pay_ok', amountMinor: 50_000 });
  });

  it('falls back to the link amount when amount_paid is missing', () => {
    const out = mapRazorpayPaymentLink({
      id: 'plink_1',
      status: 'paid',
      amount: 777,
      payments: [{ payment_id: 'pay_1', status: 'captured' }],
    });
    expect(out.amountMinor).toBe(777);
  });

  it.each([
    ['expired', 'expired', 'LINK_EXPIRED'],
    ['cancelled', 'cancelled', 'LINK_CANCELLED'],
  ])('maps %s → %s with failure code', (status, expected, code) => {
    const out = mapRazorpayPaymentLink({ ...link, status });
    expect(out).toMatchObject({ status: expected, failureCode: code, paymentRef: null });
  });

  it.each(['created', 'partially_paid'])('maps %s → pending', (status) => {
    expect(mapRazorpayPaymentLink({ ...link, status }).status).toBe('pending');
  });

  it('maps unrecognised statuses → unknown', () => {
    expect(mapRazorpayPaymentLink({ ...link, status: 'weird' }).status).toBe('unknown');
  });

  it('keeps only ids / amounts / statuses in rawPayload (drops customer PII + card data)', () => {
    const out = mapRazorpayPaymentLink({
      ...link,
      status: 'paid',
      amount_paid: 50_000,
      customer: { contact: '+919999999999', email: 'a@b.c' },
      payments: [
        { payment_id: 'pay_ok', amount: 50_000, status: 'captured', card: { number: '4111111111111111' } },
      ],
    } as never);
    const json = JSON.stringify(out.rawPayload);
    expect(json).not.toContain('9999999999');
    expect(json).not.toContain('a@b.c');
    expect(json).not.toContain('4111');
    expect(out.rawPayload).toMatchObject({ source: 'reconcile', provider: 'razorpay', id: 'plink_1' });
  });
});

describe('mapStripePaymentLink', () => {
  const session = (o: Partial<Parameters<typeof mapStripePaymentLink>[1][number]> = {}) => ({
    id: 'cs_1',
    status: 'open',
    payment_status: 'unpaid',
    payment_intent: null,
    amount_total: 50_000,
    ...o,
  });

  it('maps a paid session → captured with the payment_intent id', () => {
    const out = mapStripePaymentLink({ id: 'plink_s', active: true }, [
      session({ id: 'cs_expired', status: 'expired' }),
      session({ id: 'cs_paid', status: 'complete', payment_status: 'paid', payment_intent: 'pi_1' }),
    ]);
    expect(out).toMatchObject({ status: 'captured', paymentRef: 'pi_1', amountMinor: 50_000 });
  });

  it('falls back to the session id when there is no payment_intent', () => {
    const out = mapStripePaymentLink({ id: 'plink_s', active: true }, [
      session({ id: 'cs_paid', payment_status: 'paid' }),
    ]);
    expect(out.paymentRef).toBe('cs_paid');
  });

  it('maps a deactivated link without payment → cancelled', () => {
    const out = mapStripePaymentLink({ id: 'plink_s', active: false }, [session()]);
    expect(out).toMatchObject({ status: 'cancelled', failureCode: 'LINK_DEACTIVATED' });
  });

  it('maps an active link with only open / expired sessions → pending', () => {
    const out = mapStripePaymentLink({ id: 'plink_s', active: true }, [
      session({ status: 'expired' }),
      session(),
    ]);
    expect(out.status).toBe('pending');
  });

  it('drops customer details from rawPayload', () => {
    const out = mapStripePaymentLink({ id: 'plink_s', active: true }, [
      { ...session(), customer_details: { email: 'x@y.z', phone: '+15555555555' } } as never,
    ]);
    const json = JSON.stringify(out.rawPayload);
    expect(json).not.toContain('x@y.z');
    expect(json).not.toContain('5555555555');
  });
});

describe('provider.fetchStatus when unconfigured', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.STRIPE_SECRET_KEY;
  });
  afterAll(() => {
    process.env = saved;
  });

  it('razorpay returns unknown without calling the SDK', async () => {
    await expect(new RazorpayProvider().fetchStatus('plink_1')).resolves.toMatchObject({
      status: 'unknown',
    });
  });

  it('stripe returns unknown without calling the SDK', async () => {
    await expect(new StripeProvider().fetchStatus('plink_1')).resolves.toMatchObject({
      status: 'unknown',
    });
  });

  it('razorpay treats mock refs as unknown even when configured', async () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_x';
    process.env.RAZORPAY_KEY_SECRET = 'not-a-real-secret';
    await expect(new RazorpayProvider().fetchStatus('mock_inv_1')).resolves.toMatchObject({
      status: 'unknown',
    });
  });

  it('stripe treats mock refs as unknown even when configured', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_not_real';
    await expect(new StripeProvider().fetchStatus('stripe_mock_inv_1')).resolves.toMatchObject({
      status: 'unknown',
    });
  });
});
