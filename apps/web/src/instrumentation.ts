/**
 * Server-side error tracking (Node + Edge runtimes). No-op without a DSN.
 * No default PII; URLs lose their query strings before leaving the server.
 */
import * as Sentry from '@sentry/nextjs';

export function register(): void {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.url) event.request.url = event.request.url.split('?')[0];
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
      }
      return event;
    },
  });
}

export const onRequestError = Sentry.captureRequestError;
