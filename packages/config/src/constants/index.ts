/**
 * App-wide constants. Values that are derivable from env should live in
 * `env/`, not here.
 */

export const APP_NAME = 'AC Platform';
export const APP_DOMAIN = 'acplatform.example';
export const SUPPORT_EMAIL = 'support@acplatform.example';
export const SUPPORT_PHONE = '+919999999999';

/** Default pagination knobs. */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

/** Cache TTLs in seconds. */
export const CACHE_TTL = {
  SHORT: 60,
  MEDIUM: 5 * 60,
  LONG: 60 * 60,
  DAY: 24 * 60 * 60,
} as const;

/** Redis key prefixes — never collide with another service. */
export const REDIS_KEYS = {
  AUTH_SESSION: 'auth:session',
  AUTH_REFRESH: 'auth:refresh',
  AUTH_OTP: 'auth:otp',
  AUTH_OTP_ATTEMPTS: 'auth:otp:attempts',
  RATE_LIMIT: 'ratelimit',
  TECHNICIAN_LOCATION: 'tech:location',
  BOOKING_LOCK: 'booking:lock',
} as const;

/** Queue / job names. */
export const QUEUE_NAMES = {
  NOTIFICATIONS: 'notifications',
  WHATSAPP: 'whatsapp',
  EMAILS: 'emails',
  INVOICES: 'invoices',
  PAYMENTS: 'payments',
  ANALYTICS: 'analytics',
} as const;

/** Default tenant/city codes (will be overridden by DB in prod). */
export const DEFAULT_TENANT = 'default';

/** Service-level commitments per city: time-to-assign technician (minutes). */
export const SLA_MINUTES = {
  STANDARD: 60,
  PRIORITY: 30,
  EMERGENCY: 15,
} as const;

/** Phone & locale defaults. */
export const DEFAULT_COUNTRY_CODE = 'IN';
export const DEFAULT_CURRENCY = 'INR' as const;
export const DEFAULT_LOCALE = 'en-IN';
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/** Bcrypt / password hashing. */
export const PASSWORD = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 128,
  BCRYPT_ROUNDS: 12,
} as const;

/** OTP defaults shared between API and SMS service. */
export const OTP = {
  LENGTH: 6,
  EXPIRY_SECONDS: 300,
  MAX_ATTEMPTS: 5,
  RESEND_COOLDOWN_SECONDS: 60,
} as const;
