/**
 * Error tracking. Imported first in main.ts so Sentry can instrument modules
 * as they load. A no-op unless SENTRY_DSN is set.
 *
 * Privacy: no default PII, and request bodies, cookies, auth headers and
 * query strings are dropped before events leave the process (they can hold
 * OTP codes, tokens and phone numbers).
 */
import * as Sentry from '@sentry/nestjs';

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    sendDefaultPii: false,
    beforeSend(event) {
      return scrubEvent(event);
    },
  });
}

export function scrubEvent<T extends { request?: object }>(event: T): T {
  // Sentry's RequestEventData has no index signature; treat it as a plain record here.
  const request = event.request as Record<string, unknown> | undefined;
  if (request) {
    delete request.data;
    delete request.cookies;
    delete request.query_string;
    const headers = request.headers as Record<string, unknown> | undefined;
    if (headers) {
      for (const h of ['authorization', 'cookie', 'x-internal-token', 'x-razorpay-signature', 'stripe-signature']) {
        delete headers[h];
      }
    }
    if (typeof request.url === 'string') {
      request.url = request.url.split('?')[0];
    }
  }
  return event;
}
