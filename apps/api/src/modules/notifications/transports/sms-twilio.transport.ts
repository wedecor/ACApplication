import { NotificationChannel } from '@ac/types';
import type {
  NotificationMessage,
  NotificationRecipient,
  NotificationTransport,
  SendResult,
} from '@ac/notifications';

export interface TwilioSmsConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export class TwilioSmsTransport implements NotificationTransport {
  readonly channel = NotificationChannel.SMS;

  constructor(private readonly config: TwilioSmsConfig) {}

  async send(
    recipient: NotificationRecipient,
    message: NotificationMessage,
  ): Promise<SendResult> {
    if (!recipient.phone) {
      return { channel: this.channel, status: 'failed', error: 'Missing phone number' };
    }
    const body = message.text ?? message.template;
    const auth = Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString(
      'base64',
    );
    const params = new URLSearchParams({
      To: recipient.phone,
      From: this.config.fromNumber,
      Body: body,
    });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      return { channel: this.channel, status: 'failed', error: text };
    }
    const json = (await res.json()) as { sid?: string };
    return {
      channel: this.channel,
      status: 'sent',
      providerRef: json.sid,
    };
  }
}
