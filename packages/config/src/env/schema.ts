import { z } from 'zod';

/**
 * Reusable Zod primitives for env parsing. We keep them tight so a typo or
 * mis-configured env var fails fast at boot rather than at runtime.
 */

export const NodeEnv = z.enum(['development', 'test', 'staging', 'production']);
export type NodeEnv = z.infer<typeof NodeEnv>;

export const LogLevel = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']);
export type LogLevel = z.infer<typeof LogLevel>;

export const portSchema = z.coerce.number().int().min(1).max(65535);
export const booleanSchema = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');
export const urlSchema = z.string().url();
export const optionalUrlSchema = z.string().url().optional().or(z.literal('').transform(() => undefined));
export const secretSchema = z.string().min(32, 'Secret must be at least 32 characters');

/**
 * Server-only schema. Variables in here MUST NOT be exposed to a browser
 * bundle. The Next.js apps use the `runtimeEnv` allow-list to enforce that.
 */
export const serverEnvSchema = z.object({
  NODE_ENV: NodeEnv.default('development'),
  PORT: portSchema.default(4000),
  LOG_LEVEL: LogLevel.default('info'),

  // Database
  DATABASE_URL: urlSchema,
  DIRECT_URL: urlSchema.optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),

  // Redis
  REDIS_URL: urlSchema,
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: booleanSchema.default(false),

  // JWT / Auth
  JWT_SECRET: secretSchema,
  JWT_REFRESH_SECRET: secretSchema,
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  JWT_ISSUER: z.string().default('ac-platform'),
  JWT_AUDIENCE: z.string().default('ac-platform-clients'),

  // OTP
  OTP_TTL_SECONDS: z.coerce.number().int().min(60).default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(5),
  OTP_LENGTH: z.coerce.number().int().min(4).max(8).default(6),

  // App URLs (used for absolute links, CORS, emails)
  API_URL: urlSchema,
  WEB_URL: urlSchema,
  ADMIN_URL: urlSchema,

  // Observability
  SENTRY_DSN: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),

  // Storage (S3-compatible / MinIO)
  S3_ENDPOINT: optionalUrlSchema,
  S3_REGION: z.string().default('ap-south-1'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  // Email (SMTP)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: portSchema.optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),

  // SMS (Twilio / MSG91 etc.)
  SMS_PROVIDER: z.enum(['twilio', 'msg91', 'console']).default('console'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_SENDER_ID: z.string().optional(),
  MSG91_ROUTE: z.string().default('4'),

  // Email
  EMAIL_PROVIDER: z.enum(['smtp', 'resend', 'console']).default('console'),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().email().optional(),

  // Push (Expo)
  PUSH_PROVIDER: z.enum(['expo', 'console']).default('console'),
  EXPO_ACCESS_TOKEN: z.string().optional(),

  // Notification queue
  NOTIFICATION_QUEUE_ENABLED: booleanSchema.default(true),
  NOTIFICATION_MAX_RETRIES: z.coerce.number().int().min(0).max(20).default(5),
  NOTIFICATION_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(64).default(8),
  NOTIFICATION_KILL_SWITCH: booleanSchema.default(false),
  NOTIFICATION_CIRCUIT_FAILURE_THRESHOLD: z.coerce.number().int().min(1).default(5),
  NOTIFICATION_CIRCUIT_OPEN_MS: z.coerce.number().int().min(1000).default(60_000),
  NOTIFICATION_OTP_RATE_LIMIT_PER_HOUR: z.coerce.number().int().min(1).default(10),
  NOTIFICATION_USER_RATE_LIMIT_PER_HOUR: z.coerce.number().int().min(1).default(100),
  NOTIFICATION_STORM_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(500),
  METRICS_ENABLED: booleanSchema.default(true),
  METRICS_SCRAPE_SECRET: z.string().optional(),

  // RBAC — registry sync and startup validation
  RBAC_VALIDATE_ON_STARTUP: booleanSchema.default(true),
  RBAC_SYNC_ON_STARTUP: booleanSchema.default(false),
  EXPO_WEBHOOK_SECRET: z.string().optional(),
  CALL_WEBHOOK_SECRET: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  TWILIO_WEBHOOK_AUTH_TOKEN: z.string().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),

  // WhatsApp Cloud API
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),

  // Razorpay
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // Stripe (international fallback)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Rate limiting
  RATE_LIMIT_GLOBAL_RPS: z.coerce.number().int().min(1).default(100),
  RATE_LIMIT_AUTH_RPS: z.coerce.number().int().min(1).default(5),
}).superRefine((env, ctx) => {
  if (env.NODE_ENV !== 'production') return;

  const requireFields = (fields: Array<keyof typeof env>, message: string) => {
    for (const field of fields) {
      if (!env[field]) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [field] });
      }
    }
  };

  if (env.SMS_PROVIDER === 'twilio') {
    requireFields(
      ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'],
      'Twilio SMS requires account SID, auth token, and from number in production',
    );
  }
  if (env.SMS_PROVIDER === 'msg91') {
    requireFields(
      ['MSG91_AUTH_KEY', 'MSG91_SENDER_ID'],
      'MSG91 SMS requires auth key and sender ID in production',
    );
  }
  if (env.EMAIL_PROVIDER === 'smtp') {
    requireFields(
      ['SMTP_HOST', 'SMTP_PORT', 'SMTP_FROM'],
      'SMTP email requires host, port, and from address in production',
    );
  }
  if (env.EMAIL_PROVIDER === 'resend') {
    requireFields(['RESEND_API_KEY', 'RESEND_FROM'], 'Resend email requires API key and from address');
  }
  if (env.PUSH_PROVIDER === 'expo' && !env.EXPO_ACCESS_TOKEN) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Expo push requires EXPO_ACCESS_TOKEN in production',
      path: ['EXPO_ACCESS_TOKEN'],
    });
  }
  if (env.WHATSAPP_PHONE_NUMBER_ID || env.WHATSAPP_ACCESS_TOKEN) {
    requireFields(
      ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_VERIFY_TOKEN'],
      'WhatsApp requires phone number id, access token, and verify token',
    );
  }
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Client schema (exposed to browser). Only NEXT_PUBLIC_* vars allowed.
 */
export const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: urlSchema,
  NEXT_PUBLIC_WEB_URL: urlSchema,
  NEXT_PUBLIC_ADMIN_URL: urlSchema,
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_GA_ID: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: optionalUrlSchema,
  NEXT_PUBLIC_RAZORPAY_KEY_ID: z.string().optional(),
  NEXT_PUBLIC_MAPS_API_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_NAME: z.string().default('AC Platform'),
  NEXT_PUBLIC_APP_ENV: NodeEnv.default('development'),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
