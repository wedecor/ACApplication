import { NotificationChannel } from '@ac/types';
import type {
  NotificationMessage,
  NotificationRecipient,
  NotificationTransport,
  SendResult,
} from '@ac/notifications';

export interface Msg91SmsConfig {
  authKey: string;
  senderId: string;
  route?: string;
}

export class Msg91SmsTransport implements NotificationTransport {
  readonly channel = NotificationChannel.SMS;

  constructor(private readonly config: Msg91SmsConfig) {}

  async send(
    recipient: NotificationRecipient,
    message: NotificationMessage,
  ): Promise<SendResult> {
    if (!recipient.phone) {
      return { channel: this.channel, status: 'failed', error: 'Missing phone number' };
    }
    const mobile = recipient.phone.replace(/^\+/, '');
    const body = message.text ?? message.template;
    const params = new URLSearchParams({
      authkey: this.config.authKey,
      mobiles: mobile,
      message: body,
      sender: this.config.senderId,
      route: this.config.route ?? '4',
    });
    const res = await fetch(`https://api.msg91.com/api/sendhttp.php?${params.toString()}`);
    const text = await res.text();
    if (!res.ok || text.toLowerCase().includes('error')) {
      return { channel: this.channel, status: 'failed', error: text };
    }
    return { channel: this.channel, status: 'sent', providerRef: text.trim() };
  }
}
