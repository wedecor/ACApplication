import { NotificationChannel } from '@ac/types';
import type {
  NotificationMessage,
  NotificationRecipient,
  NotificationTransport,
  SendResult,
} from '@ac/notifications';

export interface ResendEmailConfig {
  apiKey: string;
  from: string;
}

export class ResendEmailTransport implements NotificationTransport {
  readonly channel = NotificationChannel.EMAIL;

  constructor(private readonly config: ResendEmailConfig) {}

  async send(
    recipient: NotificationRecipient,
    message: NotificationMessage,
  ): Promise<SendResult> {
    if (!recipient.email) {
      return { channel: this.channel, status: 'failed', error: 'Missing email address' };
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.config.from,
        to: [recipient.email],
        subject: message.subject ?? message.template,
        text: message.text ?? message.template,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { channel: this.channel, status: 'failed', error: text };
    }
    const json = (await res.json()) as { id?: string };
    return { channel: this.channel, status: 'sent', providerRef: json.id };
  }
}
