import { NotificationChannel } from '@ac/types';
import type {
  NotificationMessage,
  NotificationRecipient,
  NotificationTransport,
  SendResult,
} from '@ac/notifications';
import nodemailer from 'nodemailer';

export interface SmtpEmailConfig {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  from: string;
  secure?: boolean;
}

export class SmtpEmailTransport implements NotificationTransport {
  readonly channel = NotificationChannel.EMAIL;
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly config: SmtpEmailConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure ?? config.port === 465,
      auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
    });
  }

  async send(
    recipient: NotificationRecipient,
    message: NotificationMessage,
  ): Promise<SendResult> {
    if (!recipient.email) {
      return { channel: this.channel, status: 'failed', error: 'Missing email address' };
    }
    try {
      const info = await this.transporter.sendMail({
        from: this.config.from,
        to: recipient.email,
        subject: message.subject ?? message.template,
        text: message.text ?? message.template,
      });
      return {
        channel: this.channel,
        status: 'sent',
        providerRef: info.messageId,
        provider: 'smtp',
      };
    } catch (err) {
      return {
        channel: this.channel,
        status: 'failed',
        error: err instanceof Error ? err.message : 'SMTP send failed',
        provider: 'smtp',
      };
    }
  }
}
