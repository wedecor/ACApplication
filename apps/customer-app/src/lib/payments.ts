import * as WebBrowser from 'expo-web-browser';

import { invoicesApi } from '@/api/endpoints';
import { ApiError } from '@/lib/api-client';

/**
 * Cross-gateway payment driver.
 *
 * The customer app never embeds Razorpay's or Stripe's native checkout
 * SDK directly. Instead the backend creates an order or PaymentIntent
 * server-side and returns a hosted checkout URL (Razorpay's
 * `https://api.razorpay.com/v1/checkout/embedded/...` or Stripe's
 * hosted checkout). We open that URL in `expo-web-browser`, then ping
 * `/invoices/:id/pay/confirm` to surface the final state to the app.
 *
 * Why this design?
 *   1. Keeps the EAS binary lean (no native checkout SDKs).
 *   2. Lets the server stay the source of truth for amounts, taxes,
 *      surcharges, AMC offsets, and dispute trails.
 *   3. Makes UPI Intent flows work on Android via Razorpay's hosted
 *      page \u2014 no additional integration on our side.
 */
export interface PaymentResult {
  status: 'PAID' | 'PARTIAL' | 'PENDING' | 'CANCELLED' | 'FAILED';
  receiptUrl?: string;
  message?: string;
}

export async function payInvoice(
  invoiceId: string,
  opts: { gateway?: 'razorpay' | 'stripe'; methodId?: string } = {},
): Promise<PaymentResult> {
  const gateway = opts.gateway ?? 'razorpay';
  let intent: Awaited<ReturnType<typeof invoicesApi.pay>>;
  try {
    intent = await invoicesApi.pay(invoiceId, { gateway, methodId: opts.methodId });
  } catch (err) {
    return {
      status: 'FAILED',
      message: err instanceof ApiError ? err.message : 'Could not start payment.',
    };
  }

  const checkoutUrl = buildCheckoutUrl(intent);
  if (!checkoutUrl) {
    return { status: 'FAILED', message: 'Payment URL missing from server response.' };
  }

  const result = await WebBrowser.openAuthSessionAsync(
    checkoutUrl,
    'acplatform://pay/return',
    { showInRecents: false },
  );

  if (result.type !== 'success') {
    return { status: 'CANCELLED', message: 'Payment cancelled.' };
  }

  // Confirm with the server \u2014 webhook may have already done so but a
  // belt-and-braces confirm guarantees the UI updates immediately.
  try {
    const confirmation = await invoicesApi.confirm(invoiceId, {
      gateway,
      returnUrl: result.url,
    });
    return {
      status: confirmation.status === 'PAID' ? 'PAID' : confirmation.status === 'PARTIAL' ? 'PARTIAL' : 'PENDING',
      receiptUrl: confirmation.receiptUrl,
    };
  } catch (err) {
    return {
      status: 'PENDING',
      message: err instanceof ApiError ? err.message : 'Payment posted, awaiting confirmation.',
    };
  }
}

function buildCheckoutUrl(intent: Awaited<ReturnType<typeof invoicesApi.pay>>): string | null {
  if (intent.gateway === 'razorpay') {
    // Backend hands us a hosted checkout link to keep the mobile bundle thin.
    // It packages the order id, key and amount; the page redirects back to
    // `acplatform://pay/return` (configured in the order) on completion.
    return (intent as unknown as { checkoutUrl?: string }).checkoutUrl ?? null;
  }
  if (intent.gateway === 'stripe') {
    return (intent as unknown as { checkoutUrl?: string }).checkoutUrl ?? null;
  }
  return null;
}
