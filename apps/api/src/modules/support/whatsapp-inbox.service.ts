import { Injectable, Logger, Optional } from '@nestjs/common';

import { ConversationChannel, MessageStatus } from '@ac/types';
import { WhatsAppClient } from '@ac/whatsapp';

import { ConversationsService } from './conversations.service';

/**
 * WhatsApp inbox bridge — parses Meta Cloud API webhook payloads and
 * routes them into the omnichannel ConversationsService.
 *
 * The `WhatsAppClient` instance is optional: if no `WHATSAPP_*` env vars
 * are configured the service operates as a no-op transport (used for
 * local development and the seed dataset).
 */
@Injectable()
export class WhatsAppInboxService {
  private readonly logger = new Logger(WhatsAppInboxService.name);
  private readonly client?: WhatsAppClient;
  private readonly defaultTenantId: string;
  private readonly appSecret: string | undefined;

  constructor(@Optional() private readonly conversations: ConversationsService) {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
    this.appSecret = process.env.WHATSAPP_APP_SECRET;
    this.defaultTenantId = process.env.WHATSAPP_DEFAULT_TENANT_ID ?? 'default';
    if (phoneNumberId && accessToken && verifyToken) {
      this.client = new WhatsAppClient({ phoneNumberId, accessToken, verifyToken });
    } else {
      this.logger.warn(
        'WhatsApp Cloud API env vars missing — WhatsApp transport is disabled (webhooks still accepted in NO-OP mode).',
      );
    }
  }

  /** GET /webhooks/whatsapp — Meta subscription handshake. */
  verifySubscription(query: Record<string, unknown>): string | null {
    if (!this.client) {
      // In dev we accept any challenge so the local listener works.
      return (query['hub.challenge'] as string | undefined) ?? null;
    }
    return this.client.verifySubscription({
      'hub.mode': query['hub.mode'] as string | undefined,
      'hub.verify_token': query['hub.verify_token'] as string | undefined,
      'hub.challenge': query['hub.challenge'] as string | undefined,
    });
  }

  /** Validate Meta's X-Hub-Signature-256 header against the raw body. */
  verifySignature(rawBody: string, header: string | undefined): boolean {
    if (!this.appSecret) {
      this.logger.warn('WHATSAPP_APP_SECRET unset — signature verification skipped');
      return true;
    }
    if (!this.client) return true;
    return this.client.verifySignature(rawBody, header, this.appSecret);
  }

  /**
   * POST /webhooks/whatsapp — entry point for Meta-shaped payloads.
   * Returns the number of messages and status events ingested.
   */
  async handleWebhook(body: unknown): Promise<{ messages: number; statuses: number }> {
    const payload = body as WhatsAppWebhookPayload;
    if (!payload || payload.object !== 'whatsapp_business_account') {
      return { messages: 0, statuses: 0 };
    }
    let messages = 0;
    let statuses = 0;
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value) continue;
        const tenantId = this.resolveTenantId(value);

        for (const msg of value.messages ?? []) {
          await this.ingestMessage(tenantId, value, msg);
          messages += 1;
        }
        for (const st of value.statuses ?? []) {
          await this.ingestStatus(tenantId, st);
          statuses += 1;
        }
      }
    }
    return { messages, statuses };
  }

  private async ingestMessage(
    tenantId: string,
    value: WhatsAppChangeValue,
    msg: WhatsAppInboundMessage,
  ): Promise<void> {
    const phone = msg.from;
    const contact = value.contacts?.find((c) => c.wa_id === phone);
    const body = extractWhatsAppBody(msg);
    if (!body) return;
    await this.conversations.ingestInbound({
      tenantId,
      channel: ConversationChannel.WHATSAPP,
      threadIdentifier: phone,
      externalMessageId: msg.id,
      body,
      customerLookupPhone: `+${phone}`,
      fromName: contact?.profile?.name,
      occurredAt: msg.timestamp ? new Date(Number(msg.timestamp) * 1000) : undefined,
      rawPayload: msg as unknown as Record<string, unknown>,
    });
  }

  private async ingestStatus(
    tenantId: string,
    st: WhatsAppStatusEvent,
  ): Promise<void> {
    const mapped = mapWhatsAppStatus(st.status);
    if (!mapped) return;
    await this.conversations.updateMessageStatus(
      tenantId,
      st.id,
      ConversationChannel.WHATSAPP,
      mapped,
      st.timestamp ? new Date(Number(st.timestamp) * 1000) : undefined,
    );
  }

  /**
   * Resolve which tenant the webhook belongs to. The simplest approach is
   * to use `WHATSAPP_DEFAULT_TENANT_ID` for single-tenant deployments and
   * derive from `metadata.phone_number_id` for multi-tenant ones.
   */
  private resolveTenantId(value: WhatsAppChangeValue): string {
    const phoneNumberId = value.metadata?.phone_number_id;
    if (phoneNumberId && process.env[`WHATSAPP_TENANT_FOR_${phoneNumberId}`]) {
      return process.env[`WHATSAPP_TENANT_FOR_${phoneNumberId}`]!;
    }
    return this.defaultTenantId;
  }
}

function extractWhatsAppBody(msg: WhatsAppInboundMessage): string | null {
  if (msg.text?.body) return msg.text.body;
  if (msg.button?.text) return msg.button.text;
  if (msg.interactive?.button_reply?.title) return msg.interactive.button_reply.title;
  if (msg.interactive?.list_reply?.title) return msg.interactive.list_reply.title;
  if (msg.image) return '[Image]';
  if (msg.audio) return '[Audio]';
  if (msg.video) return '[Video]';
  if (msg.document?.filename) return `[Document: ${msg.document.filename}]`;
  if (msg.location) return '[Location]';
  if (msg.reaction?.emoji) return msg.reaction.emoji;
  return null;
}

function mapWhatsAppStatus(status: string): MessageStatus | null {
  switch (status) {
    case 'sent':
      return MessageStatus.SENT;
    case 'delivered':
      return MessageStatus.DELIVERED;
    case 'read':
      return MessageStatus.READ;
    case 'failed':
      return MessageStatus.FAILED;
    default:
      return null;
  }
}

// ---------------------------------------------------------------- types

interface WhatsAppWebhookPayload {
  object?: string;
  entry?: Array<{ id: string; changes?: WhatsAppChange[] }>;
}

interface WhatsAppChange {
  field?: string;
  value?: WhatsAppChangeValue;
}

interface WhatsAppChangeValue {
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  contacts?: Array<{ wa_id: string; profile?: { name?: string } }>;
  messages?: WhatsAppInboundMessage[];
  statuses?: WhatsAppStatusEvent[];
}

interface WhatsAppInboundMessage {
  id: string;
  from: string;
  timestamp?: string;
  type?: string;
  text?: { body: string };
  button?: { text: string; payload?: string };
  interactive?: {
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
  image?: { id: string; mime_type?: string; sha256?: string };
  audio?: { id: string; mime_type?: string };
  video?: { id: string; mime_type?: string };
  document?: { id: string; filename?: string };
  location?: { latitude: number; longitude: number };
  reaction?: { emoji: string };
}

interface WhatsAppStatusEvent {
  id: string;
  status: string;
  timestamp?: string;
  recipient_id?: string;
}
