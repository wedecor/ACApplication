import { NotificationChannel } from '@ac/types';
import type {
  NotificationMessage,
  NotificationRecipient,
  NotificationTransport,
  SendResult,
} from '@ac/notifications';

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
    const json = (await res.json()) as { data?: Array<{ status?: string; id?: string }> };
    const ticket = json.data?.[0];
    if (ticket?.status === 'error') {
      return { channel: this.channel, status: 'failed', error: 'Expo push rejected' };
    }
    return { channel: this.channel, status: 'sent', providerRef: ticket?.id };
  }
}
