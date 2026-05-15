import type { NotificationChannel } from '@ac/types';

/** Deterministic idempotency keys for cross-restart deduplication. */
export const IdempotencyKeys = {
  bookingConfirmed: (bookingId: string, channel: NotificationChannel) =>
    `booking-confirmed:${bookingId}:${channel.toLowerCase()}`,
  bookingOtp: (bookingId: string) => `booking-otp:${bookingId}:sms`,
  otp: (destination: string, purpose: string) => `otp:${destination}:${purpose}`,
  invoiceReminder: (invoiceId: string, channel: NotificationChannel) =>
    `invoice-reminder:${invoiceId}:${channel.toLowerCase()}`,
  paymentReceipt: (invoiceId: string) => `payment-receipt:${invoiceId}:push`,
  supportReply: (messageId: string) => `support-reply:${messageId}`,
  conversation: (messageId: string) => `conversation:${messageId}`,
} as const;

/** Scope channel into a base key at enqueue time (one row per channel). */
export function scopeIdempotencyKey(base: string, channel: NotificationChannel): string {
  return `${base}:${channel.toLowerCase()}`;
}
