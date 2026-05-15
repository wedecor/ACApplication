import { NotificationChannel } from '@ac/types';
import type {
  NotificationMessage,
  NotificationRecipient,
  NotificationTransport,
  SendResult,
} from '@ac/notifications';

import type { RealtimeGateway } from '../../realtime/realtime.gateway';

export class InAppTransport implements NotificationTransport {
  readonly channel = NotificationChannel.IN_APP;

  constructor(private readonly realtime: RealtimeGateway) {}

  async send(
    recipient: NotificationRecipient,
    message: NotificationMessage,
  ): Promise<SendResult> {
    if (!recipient.userId) {
      return { channel: this.channel, status: 'failed', error: 'Missing userId for in-app' };
    }
    this.realtime.emitToRoom(`user:${recipient.userId}`, 'notification.in_app', {
      template: message.template,
      text: message.text,
      subject: message.subject,
      data: message.data,
    });
    return { channel: this.channel, status: 'sent' };
  }
}
