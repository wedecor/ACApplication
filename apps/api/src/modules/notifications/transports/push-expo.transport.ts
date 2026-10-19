import type {
  NotificationMessage,
  NotificationRecipient,
  NotificationTransport,
  SendResult,
} from '@ac/notifications';
import { NotificationChannel } from '@ac/types';

const PROVIDER_TIMEOUT_MS = 10_000;

export interface ExpoPushConfig {
  accessToken?: string;
}

export class ExpoPushTransport implements NotificationTransport {
  readonly channel = NotificationChannel.PUSH;

  constructor(private readonly config: ExpoPushConfig = {}) {}

  async send(
    recipient: NotificationRecipient,
    message: NotificationMessage,
  ): Promise<SendResult> {
    const tokens = recipient.deviceTokens?.filter(Boolean) ?? [];
    if (tokens.length === 0) {
      return { channel: this.channel, status: 'failed', error: 'No push tokens' };
    }
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (this.config.accessToken) {
      headers.Authorization = `Bearer ${this.config.accessToken}`;
    }
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      // Never hang a worker on a slow provider.
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      method: 'POST',
      headers,
      body: JSON.stringify(
        tokens.map((to) => ({
          to,
          title: message.subject ?? 'AC Platform',
          body: message.text ?? message.template,
          data: message.data,
        })),
      ),
    });
    if (!res.ok) {
      const text = await res.text();
      return { channel: this.channel, status: 'failed', error: text };
    }
    const json = (await res.json()) as { data?: { status?: string; id?: string }[] };
    const ticket = json.data?.[0];
    if (ticket?.status === 'error') {
      return { channel: this.channel, status: 'failed', error: 'Expo push rejected' };
    }
    return { channel: this.channel, status: 'sent', providerRef: ticket?.id };
  }
}
