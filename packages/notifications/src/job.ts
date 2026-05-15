import type { NotificationChannel } from '@ac/types';

/** BullMQ job payload — one row per channel in `notifications`. */
export interface NotificationJobPayload {
  notificationId: string;
  correlationId?: string;
}

export interface EnqueueNotificationInput {
  tenantId: string;
  recipient: {
    userId?: string;
    email?: string;
    phone?: string;
  };
  channels: NotificationChannel[];
  message: {
    template: string;
    data?: Record<string, unknown>;
    idempotencyKey?: string;
    locale?: string;
  };
}

export const NOTIFICATION_QUEUE_NAME = 'notification-dispatch';
export const NOTIFICATION_DLQ_NAME = 'notification-dispatch-dlq';

/** Exponential backoff in milliseconds (cap 1h). */
export function retryDelayMs(attempt: number): number {
  const base = 5_000;
  const delay = base * 2 ** Math.max(0, attempt - 1);
  return Math.min(delay, 3_600_000);
}
