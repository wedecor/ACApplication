/**
 * Channel / source helpers. Maps between `TicketSource` and the
 * `ConversationChannel` enum, since they're conceptually similar but
 * decoupled (a ticket source can be MANUAL with no channel).
 */
import { ConversationChannel, TicketSource } from '@ac/types';

export function channelFromSource(source: TicketSource): ConversationChannel | null {
  switch (source) {
    case TicketSource.WHATSAPP:
      return ConversationChannel.WHATSAPP;
    case TicketSource.EMAIL:
      return ConversationChannel.EMAIL;
    case TicketSource.PHONE:
      return ConversationChannel.PHONE;
    case TicketSource.WEB_CHAT:
      return ConversationChannel.WEB_CHAT;
    case TicketSource.IN_APP_CHAT:
      return ConversationChannel.IN_APP_CHAT;
    case TicketSource.SMS:
      return ConversationChannel.SMS;
    case TicketSource.SOCIAL:
      return ConversationChannel.SOCIAL;
    default:
      return null;
  }
}

export function sourceFromChannel(channel: ConversationChannel): TicketSource {
  switch (channel) {
    case ConversationChannel.WHATSAPP:
      return TicketSource.WHATSAPP;
    case ConversationChannel.EMAIL:
      return TicketSource.EMAIL;
    case ConversationChannel.PHONE:
      return TicketSource.PHONE;
    case ConversationChannel.WEB_CHAT:
      return TicketSource.WEB_CHAT;
    case ConversationChannel.IN_APP_CHAT:
      return TicketSource.IN_APP_CHAT;
    case ConversationChannel.SMS:
      return TicketSource.SMS;
    case ConversationChannel.SOCIAL:
      return TicketSource.SOCIAL;
    default:
      return TicketSource.MANUAL;
  }
}

/**
 * Sanitise a phone number to digits-only with an optional country prefix.
 * Used as the conversation thread key for WhatsApp / SMS / phone calls.
 */
export function normaliseE164(input: string): string {
  const trimmed = input.trim();
  const plus = trimmed.startsWith('+') ? '+' : '';
  const digits = trimmed.replace(/[^0-9]/g, '');
  return `${plus}${digits}`;
}

/**
 * Build a stable conversation thread key. WhatsApp & SMS use the customer
 * phone number; email uses the lower-cased address; web/in-app chat uses
 * the session id supplied by the client.
 */
export function buildThreadKey(channel: ConversationChannel, identifier: string): string {
  switch (channel) {
    case ConversationChannel.WHATSAPP:
    case ConversationChannel.SMS:
    case ConversationChannel.PHONE:
      return `${channel.toLowerCase()}:${normaliseE164(identifier)}`;
    case ConversationChannel.EMAIL:
      return `email:${identifier.trim().toLowerCase()}`;
    case ConversationChannel.WEB_CHAT:
    case ConversationChannel.IN_APP_CHAT:
    case ConversationChannel.SOCIAL:
      return `${channel.toLowerCase()}:${identifier}`;
    default:
      return identifier;
  }
}

/** Short preview generator for inbox lists / notifications. */
export function buildPreview(body: string, limit = 120): string {
  const single = body.replace(/\s+/g, ' ').trim();
  if (single.length <= limit) return single;
  return `${single.slice(0, limit - 1)}…`;
}
