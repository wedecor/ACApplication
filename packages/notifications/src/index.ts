import type { NotificationChannel } from '@ac/types';

export interface NotificationRecipient {
  userId?: string;
  email?: string;
  phone?: string;
  deviceTokens?: string[];
}

export interface NotificationMessage {
  /** Template key (must exist in `notification_templates`). */
  template: string;
  /** Channel for this dispatch attempt. */
  channel: NotificationChannel;
  /** Template variables. */
  data?: Record<string, unknown>;
  /** Tracking / idempotency key. */
  idempotencyKey?: string;
  locale?: string;
  /** Resolved body after template lookup (set by the dispatcher). */
  text?: string;
  subject?: string;
}

export interface SendResult {
  channel: NotificationChannel;
  providerRef?: string;
  /** Provider that accepted the send (failover layer). */
  provider?: string;
  status: 'queued' | 'sent' | 'failed';
  error?: string;
}

/**
 * Channel transport — implement per provider (Twilio, SES, FCM, Meta…).
 */
export interface NotificationTransport {
  channel: NotificationChannel;
  send(
    recipient: NotificationRecipient,
    message: NotificationMessage,
  ): Promise<SendResult>;
}

/**
 * High-level dispatcher. Apps register transports per channel and call
 * `dispatch()` with the desired channels (multi-channel fan-out).
 */
export class NotificationDispatcher {
  private readonly transports = new Map<NotificationChannel, NotificationTransport>();

  register(transport: NotificationTransport): void {
    this.transports.set(transport.channel, transport);
  }

  async dispatch(
    recipient: NotificationRecipient,
    channels: NotificationChannel[],
    message: Omit<NotificationMessage, 'channel'>,
  ): Promise<SendResult[]> {
    const results: SendResult[] = [];
    for (const channel of channels) {
      const transport = this.transports.get(channel);
      if (!transport) {
        results.push({ channel, status: 'failed', error: `No transport for channel ${channel}` });
        continue;
      }
      try {
        const r = await transport.send(recipient, { ...message, channel });
        results.push(r);
      } catch (err) {
        results.push({
          channel,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
    return results;
  }
}

export { renderTemplate } from './template';
export {
  NOTIFICATION_DLQ_NAME,
  NOTIFICATION_QUEUE_NAME,
  retryDelayMs,
  type EnqueueNotificationInput,
  type NotificationJobPayload,
} from './job';
export { IdempotencyKeys, scopeIdempotencyKey } from './idempotency';
export {
  circuitKey,
  DEFAULT_CIRCUIT_CONFIG,
  type CircuitBreakerConfig,
  type CircuitSnapshot,
  type CircuitState,
} from './circuit-breaker';
export { sendWithFailover, type FailoverSendContext, type NamedProvider } from './failover';

/** Console transport for local dev. */
export class ConsoleTransport implements NotificationTransport {
  constructor(public readonly channel: NotificationChannel) {}
  send(recipient: NotificationRecipient, message: NotificationMessage): Promise<SendResult> {
    console.info(`[notifications:${this.channel}]`, { recipient, message });
    return Promise.resolve({ channel: this.channel, status: 'sent' });
  }
}
