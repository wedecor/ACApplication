import { ConversationChannel, TicketSource } from '@ac/types';

import {
  buildPreview,
  buildThreadKey,
  channelFromSource,
  normaliseE164,
  sourceFromChannel,
} from '../channels';

describe('common/support/channels', () => {
  describe('channelFromSource ↔ sourceFromChannel', () => {
    it('roundtrips for every channel-backed source', () => {
      const sources: TicketSource[] = [
        TicketSource.WHATSAPP,
        TicketSource.EMAIL,
        TicketSource.PHONE,
        TicketSource.WEB_CHAT,
        TicketSource.IN_APP_CHAT,
        TicketSource.SMS,
        TicketSource.SOCIAL,
      ];
      for (const source of sources) {
        const channel = channelFromSource(source);
        expect(channel).not.toBeNull();
        expect(sourceFromChannel(channel as ConversationChannel)).toBe(source);
      }
    });

    it('returns null for MANUAL source', () => {
      expect(channelFromSource(TicketSource.MANUAL)).toBeNull();
    });
  });

  describe('normaliseE164', () => {
    it('keeps a leading +', () => {
      expect(normaliseE164('+91 98765 43210')).toBe('+919876543210');
    });
    it('strips all non-digit chars', () => {
      expect(normaliseE164('(080) 1234-5678')).toBe('08012345678');
    });
  });

  describe('buildThreadKey', () => {
    it('normalises phone keys (WhatsApp / SMS / phone)', () => {
      expect(buildThreadKey(ConversationChannel.WHATSAPP, '+91 99999 99999')).toBe(
        'whatsapp:+919999999999',
      );
      expect(buildThreadKey(ConversationChannel.SMS, '+91 99999 99999')).toBe(
        'sms:+919999999999',
      );
    });

    it('lowercases email keys', () => {
      expect(buildThreadKey(ConversationChannel.EMAIL, 'Foo@Bar.COM')).toBe(
        'email:foo@bar.com',
      );
    });

    it('keeps session-id keys verbatim', () => {
      expect(
        buildThreadKey(ConversationChannel.WEB_CHAT, 'sess-1234'),
      ).toBe('web_chat:sess-1234');
    });
  });

  describe('buildPreview', () => {
    it('collapses whitespace', () => {
      expect(buildPreview('hello\n  world')).toBe('hello world');
    });
    it('truncates with an ellipsis', () => {
      const long = 'x'.repeat(200);
      const preview = buildPreview(long, 50);
      expect(preview).toHaveLength(50);
      expect(preview.endsWith('…')).toBe(true);
    });
  });
});
