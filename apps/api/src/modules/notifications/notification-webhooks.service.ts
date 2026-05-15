import { createHmac, timingSafeEqual } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { LoadedServerEnv } from '@ac/config';
import { verifyHmacSha256 } from '../../common/security/webhook-auth';
import { APP_CONFIG } from '../../common/config/config.module';
import { NotificationMetricsService } from './notification-metrics.service';
import { NotificationRepository } from './notification.repository';

@Injectable()
export class NotificationWebhooksService {
  private readonly logger = new Logger(NotificationWebhooksService.name);

  constructor(
    private readonly repo: NotificationRepository,
    private readonly metrics: NotificationMetricsService,
    @Inject(APP_CONFIG) private readonly env: LoadedServerEnv,
  ) {}

  verifyTwilioSignature(url: string, params: Record<string, string>, signature: string | undefined): boolean {
    if (!this.env.TWILIO_AUTH_TOKEN || !signature) return false;
    const data = Object.keys(params)
      .sort()
      .reduce((acc, k) => acc + k + params[k], url);
    const expected = createHmac('sha1', this.env.TWILIO_AUTH_TOKEN).update(data).digest('base64');
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  verifyExpoSignature(rawBody: string, signature: string | undefined): boolean {
    return verifyHmacSha256(rawBody, signature, this.env.EXPO_WEBHOOK_SECRET, {
      prefix: 'sha256=',
      allowDevSkip: true,
    });
  }

  verifyWhatsAppSignature(rawBody: string, signature: string | undefined): boolean {
    return verifyHmacSha256(rawBody, signature, this.env.WHATSAPP_APP_SECRET, {
      prefix: 'sha256=',
      allowDevSkip: true,
    });
  }

  verifyResendSignature(rawBody: string, signature: string | undefined): boolean {
    if (!this.env.RESEND_WEBHOOK_SECRET || !signature) return this.env.NODE_ENV === 'development';
    const expected = createHmac('sha256', this.env.RESEND_WEBHOOK_SECRET).update(rawBody).digest('hex');
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(signature.replace(/^sha256=/, '')));
    } catch {
      return false;
    }
  }

  async handleTwilioStatus(payload: {
    MessageSid?: string;
    MessageStatus?: string;
    ErrorCode?: string;
  }): Promise<void> {
    if (!payload.MessageSid) return;
    const row = await this.repo.findByProviderRef(payload.MessageSid);
    if (!row) return;

    const status = (payload.MessageStatus ?? '').toLowerCase();
    if (status === 'delivered') {
      await this.repo.markDelivered(row.id, 'twilio', payload);
    } else if (status === 'failed' || status === 'undelivered') {
      await this.repo.markFailed(row.id, payload.ErrorCode ?? status, 'twilio', payload);
      this.metrics.recordFailed(row.channel, 'twilio', row.tenantId);
    }
    this.logger.log({ notificationId: row.id, status }, 'Twilio delivery webhook');
  }

  async handleResendEvent(payload: {
    type?: string;
    data?: { email_id?: string };
  }): Promise<void> {
    const ref = payload.data?.email_id;
    if (!ref) return;
    const row = await this.repo.findByProviderRef(ref);
    if (!row) return;

    if (payload.type === 'email.delivered') {
      await this.repo.markDelivered(row.id, 'resend', payload);
    } else if (payload.type === 'email.bounced' || payload.type === 'email.failed') {
      await this.repo.markFailed(row.id, payload.type, 'resend', payload);
    }
  }

  async handleExpoReceipts(
    receipts: Array<{ status: string; id?: string; message?: string; details?: unknown }>,
  ): Promise<void> {
    for (const receipt of receipts) {
      if (!receipt.id) continue;
      const row = await this.repo.findByProviderRef(receipt.id);
      if (!row) continue;
      if (receipt.status === 'ok') {
        await this.repo.markDelivered(row.id, 'expo', receipt as Record<string, unknown>);
      } else {
        await this.repo.markFailed(row.id, receipt.message ?? 'expo error', 'expo', receipt);
      }
    }
  }

  async handleWhatsAppStatus(payload: {
    entry?: Array<{
      changes?: Array<{
        value?: {
          statuses?: Array<{
            id: string;
            status: string;
            timestamp: string;
            errors?: Array<{ title?: string }>;
          }>;
        };
      }>;
    }>;
  }): Promise<void> {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const st of change.value?.statuses ?? []) {
          const row = await this.repo.findByProviderRef(st.id);
          if (!row) continue;
          if (st.status === 'delivered' || st.status === 'read') {
            if (st.status === 'read') {
              await this.repo.markRead(row.id, 'whatsapp');
            } else {
              await this.repo.markDelivered(row.id, 'whatsapp', st);
            }
          } else if (st.status === 'failed') {
            await this.repo.markFailed(
              row.id,
              st.errors?.[0]?.title ?? 'whatsapp failed',
              'whatsapp',
              st,
            );
          }
        }
      }
    }
  }
}
