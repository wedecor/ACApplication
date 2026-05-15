import { loadClientEnv } from '@ac/config';

/**
 * Typed, Zod-validated public env for the web app. Throws at boot if any
 * required `NEXT_PUBLIC_*` variable is missing. Server-only vars live in
 * `process.env` and should be accessed via `loadServerEnv()` inside API
 * route handlers / server actions.
 */
export const env = loadClientEnv({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_WEB_URL: process.env.NEXT_PUBLIC_WEB_URL,
  NEXT_PUBLIC_ADMIN_URL: process.env.NEXT_PUBLIC_ADMIN_URL,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  NEXT_PUBLIC_MAPS_API_KEY: process.env.NEXT_PUBLIC_MAPS_API_KEY,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
});

/**
 * SEO + marketing-specific runtime configuration. These are intentionally
 * NOT validated by `@ac/config` (which enforces a fixed shape used across
 * apps) — they are public-website-only knobs and a missing value should
 * degrade gracefully rather than crash boot.
 */
export const siteConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME ?? 'AC Platform',
  shortName: 'AC Platform',
  description:
    'Same-day AC, washing machine, refrigerator & appliance repair from background-verified technicians. Transparent pricing, 30-day warranty, live tracking.',
  url: process.env.NEXT_PUBLIC_WEB_URL ?? 'https://acplatform.example.com',
  ogImage: '/og.png',
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '+919999999999',
  supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? '+919999999999',
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'hello@example.com',
  companyLegalName: process.env.NEXT_PUBLIC_LEGAL_NAME ?? 'AC Platform Pvt. Ltd.',
  companyFoundedYear: 2022,
  defaultCity: 'bengaluru',
  defaultTenantSlug: process.env.NEXT_PUBLIC_TENANT_SLUG ?? 'default',
  analytics: {
    gaId: process.env.NEXT_PUBLIC_GA_ID,
    gtmId: process.env.NEXT_PUBLIC_GTM_ID,
    metaPixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID,
  },
  social: {
    twitter: process.env.NEXT_PUBLIC_TWITTER_HANDLE ?? '@acplatform',
    facebook: process.env.NEXT_PUBLIC_FACEBOOK_URL ?? null,
    instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? null,
    youtube: process.env.NEXT_PUBLIC_YOUTUBE_URL ?? null,
  },
} as const;

export type SiteConfig = typeof siteConfig;
