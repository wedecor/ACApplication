import { createHmac, timingSafeEqual } from 'node:crypto';

import { NotificationChannel } from '@ac/types';
import type {
  NotificationMessage,
  NotificationRecipient,
  NotificationTransport,
  SendResult,
} from '@ac/notifications';
import { z } from 'zod';

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  /** Used to verify incoming webhook signatures + the GET challenge. */
  verifyToken: string;
  apiBaseUrl?: string;
}

const WhatsAppMessageSchema = z.object({
  messaging_product: z.literal('whatsapp'),
  to: z.string(),
  type: z.enum(['text', 'template']),
});

export class WhatsAppClient implements NotificationTransport {
  readonly channel = NotificationChannel.WHATSAPP;
  private readonly baseUrl: string;

  constructor(private readonly config: WhatsAppConfig) {
    this.baseUrl = config.apiBaseUrl ?? 'https://graph.facebook.com/v20.0';
  }

  async send(
    recipient: NotificationRecipient,
    message: NotificationMessage,
  ): Promise<SendResult> {
    if (!recipient.phone) {
      return { channel: this.channel, status: 'failed', error: 'Missing phone number' };
    }
    const body = {
      messaging_product: 'whatsapp',
      to: recipient.phone.replace(/^\+/, ''),
      type: 'template',
      template: {
        name: message.template,
        language: { code: message.locale ?? 'en' },
        components: message.data
          ? [
              {
                type: 'body',
                parameters: Object.values(message.data).map((v) => ({
                  type: 'text',
                  text: String(v),
                })),
              },
            ]
          : [],
      },
    };
    WhatsAppMessageSchema.parse(body);

    const res = await fetch(`${this.baseUrl}/${this.config.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return { channel: this.channel, status: 'failed', error: text };
    }
    const json = (await res.json()) as { messages?: Array<{ id: string }> };
    return {
      channel: this.channel,
      status: 'sent',
      providerRef: json.messages?.[0]?.id,
    };
  }

  /**
   * Verifies the GET challenge sent by Meta on webhook subscription.
   * Returns the `challenge` to echo back, or null on failure.
   */
  verifySubscription(query: {
    'hub.mode'?: string;
    'hub.verify_token'?: string;
    'hub.challenge'?: string;
  }): string | null {
    if (
      query['hub.mode'] === 'subscribe' &&
      query['hub.verify_token'] === this.config.verifyToken
    ) {
      return query['hub.challenge'] ?? null;
    }
    return null;
  }

  /**
   * Validates X-Hub-Signature-256 header on incoming webhook POSTs.
   */
  verifySignature(rawBody: string, header: string | undefined, appSecret: string): boolean {
    if (!header?.startsWith('sha256=')) return false;
    const expected = Buffer.from(header.slice('sha256='.length), 'hex');
    const actual = createHmac('sha256', appSecret).update(rawBody).digest();
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(expected, actual);
  }
}

export { NotificationChannel };
