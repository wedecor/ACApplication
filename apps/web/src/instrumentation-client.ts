/**
 * Browser error tracking. No-op without NEXT_PUBLIC_SENTRY_DSN. Link tokens
 * (quotation / rating pages) and query strings are stripped from URLs.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

function scrubUrl(url: string): string {
  return url.split('?')[0]!.replace(/\/(quotations|rate|r)\/[^/#]+/, '/$1/[token]');
}

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.url) event.request.url = scrubUrl(event.request.url);
      return event;
    },
    beforeBreadcrumb(crumb) {
      if (typeof crumb.data?.url === 'string') crumb.data.url = scrubUrl(crumb.data.url);
      if (typeof crumb.data?.to === 'string') crumb.data.to = scrubUrl(crumb.data.to);
      return crumb;
    },
  });
}
