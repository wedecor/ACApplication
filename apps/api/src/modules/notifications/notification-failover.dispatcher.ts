import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { LoadedServerEnv } from '@ac/config';
import {
  ConsoleTransport,
  NotificationDispatcher,
  sendWithFailover,
  type NamedProvider,
  type NotificationMessage,
  type NotificationRecipient,
  type SendResult,
} from '@ac/notifications';
import { NotificationChannel } from '@ac/types';
import { WhatsAppClient } from '@ac/whatsapp';

import { APP_CONFIG } from '../../common/config/config.module';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationMetricsService } from './notification-metrics.service';
import { ProviderHealthService } from './provider-health.service';
import { ExpoPushTransport } from './transports/push-expo.transport';
import { ResendEmailTransport } from './transports/email-resend.transport';
import { SmtpEmailTransport } from './transports/smtp-email.transport';
import { Msg91SmsTransport } from './transports/sms-msg91.transport';
import { TwilioSmsTransport } from './transports/sms-twilio.transport';
import { InAppTransport } from './transports/in-app.transport';

@Injectable()
export class NotificationFailoverDispatcher extends NotificationDispatcher implements OnModuleInit {
  private readonly logger = new Logger(NotificationFailoverDispatcher.name);
  private readonly providers = new Map<NotificationChannel, NamedProvider[]>();

  constructor(
    private readonly health: ProviderHealthService,
    private readonly metrics: NotificationMetricsService,
    private readonly realtime: RealtimeGateway,
    @Inject(APP_CONFIG) private readonly env: LoadedServerEnv,
  ) {
    super();
  }

  onModuleInit(): void {
    this.buildProviderRegistry();
  }

  async dispatchWithFailover(
    recipient: NotificationRecipient,
    channel: NotificationChannel,
    message: Omit<NotificationMessage, 'channel'>,
    tenantId: string,
  ): Promise<SendResult> {
    const providers = this.providers.get(channel) ?? [];
    if (providers.length === 0) {
      return { channel, status: 'failed', error: `No providers for ${channel}` };
    }

    return sendWithFailover(providers, {
      channel,
      recipient,
      message: { ...message, channel },
      isProviderAvailable: (provider) => this.health.isAvailable(channel, provider),
      onProviderSuccess: async (provider, latencyMs) => {
        this.metrics.recordProviderLatency(channel, provider, latencyMs);
        await this.health.recordSuccess(channel, provider);
      },
      onProviderFailure: async (provider, error, latencyMs) => {
        this.metrics.recordProviderLatency(channel, provider, latencyMs);
        await this.health.recordFailure(channel, provider);
        this.logger.warn({ channel, provider, error, tenantId }, 'Provider attempt failed');
      },
    });
  }

  private buildProviderRegistry(): void {
    const sms: NamedProvider[] = [];
    if (
      this.env.TWILIO_ACCOUNT_SID &&
      this.env.TWILIO_AUTH_TOKEN &&
      this.env.TWILIO_FROM_NUMBER
    ) {
      sms.push({
        name: 'twilio',
        priority: 1,
        transport: new TwilioSmsTransport({
          accountSid: this.env.TWILIO_ACCOUNT_SID,
          authToken: this.env.TWILIO_AUTH_TOKEN,
          fromNumber: this.env.TWILIO_FROM_NUMBER,
        }),
      });
    }
    if (this.env.MSG91_AUTH_KEY && this.env.MSG91_SENDER_ID) {
      sms.push({
        name: 'msg91',
        priority: sms.length ? 2 : 1,
        transport: new Msg91SmsTransport({
          authKey: this.env.MSG91_AUTH_KEY,
          senderId: this.env.MSG91_SENDER_ID,
          route: this.env.MSG91_ROUTE,
        }),
      });
    }
    if (sms.length === 0) {
      sms.push({ name: 'console', priority: 99, transport: new ConsoleTransport(NotificationChannel.SMS) });
    }
    this.providers.set(NotificationChannel.SMS, sms);

    const email: NamedProvider[] = [];
    if (this.env.RESEND_API_KEY && this.env.RESEND_FROM) {
      email.push({
        name: 'resend',
        priority: 1,
        transport: new ResendEmailTransport({
          apiKey: this.env.RESEND_API_KEY,
          from: this.env.RESEND_FROM,
        }),
      });
    }
    if (this.env.SMTP_HOST && this.env.SMTP_PORT && this.env.SMTP_FROM) {
      email.push({
        name: 'smtp',
        priority: email.length ? 2 : 1,
        transport: new SmtpEmailTransport({
          host: this.env.SMTP_HOST,
          port: this.env.SMTP_PORT,
          user: this.env.SMTP_USER,
          pass: this.env.SMTP_PASS,
          from: this.env.SMTP_FROM,
        }),
      });
    }
    if (email.length === 0) {
      email.push({
        name: 'console',
        priority: 99,
        transport: new ConsoleTransport(NotificationChannel.EMAIL),
      });
    }
    this.providers.set(NotificationChannel.EMAIL, email);

    const push: NamedProvider[] = [];
    if (this.env.PUSH_PROVIDER === 'expo') {
      push.push({
        name: 'expo',
        priority: 1,
        transport: new ExpoPushTransport({ accessToken: this.env.EXPO_ACCESS_TOKEN }),
      });
    } else {
      push.push({
        name: 'console',
        priority: 99,
        transport: new ConsoleTransport(NotificationChannel.PUSH),
      });
    }
    this.providers.set(NotificationChannel.PUSH, push);

    const whatsapp: NamedProvider[] = [];
    if (
      this.env.WHATSAPP_PHONE_NUMBER_ID &&
      this.env.WHATSAPP_ACCESS_TOKEN &&
      this.env.WHATSAPP_VERIFY_TOKEN
    ) {
      whatsapp.push({
        name: 'whatsapp',
        priority: 1,
        transport: new WhatsAppClient({
          phoneNumberId: this.env.WHATSAPP_PHONE_NUMBER_ID,
          accessToken: this.env.WHATSAPP_ACCESS_TOKEN,
          verifyToken: this.env.WHATSAPP_VERIFY_TOKEN,
        }),
      });
    } else {
      whatsapp.push({
        name: 'console',
        priority: 99,
        transport: new ConsoleTransport(NotificationChannel.WHATSAPP),
      });
    }
    this.providers.set(NotificationChannel.WHATSAPP, whatsapp);

    this.providers.set(NotificationChannel.IN_APP, [
      { name: 'websocket', priority: 1, transport: new InAppTransport(this.realtime) },
    ]);

    this.logger.log(
      {
        sms: sms.map((p) => p.name),
        email: email.map((p) => p.name),
        push: push.map((p) => p.name),
        whatsapp: whatsapp.map((p) => p.name),
      },
      'Failover provider registry ready',
    );
  }
}
