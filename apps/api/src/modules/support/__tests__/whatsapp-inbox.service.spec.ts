import { ConversationChannel, MessageStatus } from '@ac/types';

import { WhatsAppInboxService } from '../whatsapp-inbox.service';

describe('WhatsAppInboxService', () => {
  let conversations: { ingestInbound: jest.Mock; updateMessageStatus: jest.Mock };
  let service: WhatsAppInboxService;

  beforeEach(() => {
    conversations = {
      ingestInbound: jest.fn().mockResolvedValue({
        conversationId: 'c1',
        messageId: 'm1',
        ticketId: 't1',
        isNewConversation: false,
      }),
      updateMessageStatus: jest.fn().mockResolvedValue(undefined),
    };
    process.env.WHATSAPP_DEFAULT_TENANT_ID = 'tenant_test';
    service = new WhatsAppInboxService(conversations as never);
  });

  describe('handleWebhook', () => {
    it('routes text messages into the omnichannel ingest', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WABA-1',
            changes: [
              {
                field: 'messages',
                value: {
                  metadata: { phone_number_id: 'PN-1' },
                  contacts: [
                    { wa_id: '919999999999', profile: { name: 'Rahul' } },
                  ],
                  messages: [
                    {
                      id: 'wamid.HBgM',
                      from: '919999999999',
                      timestamp: '1735689600',
                      type: 'text',
                      text: { body: 'Hi I need AC repair' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = await service.handleWebhook(payload);
      expect(result).toEqual({ messages: 1, statuses: 0 });
      expect(conversations.ingestInbound).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant_test',
          channel: ConversationChannel.WHATSAPP,
          threadIdentifier: '919999999999',
          externalMessageId: 'wamid.HBgM',
          body: 'Hi I need AC repair',
          customerLookupPhone: '+919999999999',
          fromName: 'Rahul',
        }),
      );
    });

    it('extracts a friendly body for media-only messages', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WABA-1',
            changes: [
              {
                field: 'messages',
                value: {
                  metadata: { phone_number_id: 'PN-1' },
                  messages: [
                    {
                      id: 'm-img',
                      from: '919999999999',
                      type: 'image',
                      image: { id: 'img-id' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
      await service.handleWebhook(payload);
      expect(conversations.ingestInbound).toHaveBeenCalledWith(
        expect.objectContaining({ body: '[Image]' }),
      );
    });

    it('routes status updates to updateMessageStatus', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WABA-1',
            changes: [
              {
                field: 'messages',
                value: {
                  metadata: { phone_number_id: 'PN-1' },
                  statuses: [
                    { id: 'wamid.OUTBOUND', status: 'read', timestamp: '1735689700' },
                  ],
                },
              },
            ],
          },
        ],
      };
      const result = await service.handleWebhook(payload);
      expect(result.statuses).toBe(1);
      expect(conversations.updateMessageStatus).toHaveBeenCalledWith(
        'tenant_test',
        'wamid.OUTBOUND',
        ConversationChannel.WHATSAPP,
        MessageStatus.READ,
        expect.any(Date),
      );
    });

    it('drops payloads that are not whatsapp_business_account', async () => {
      const result = await service.handleWebhook({ object: 'page' });
      expect(result).toEqual({ messages: 0, statuses: 0 });
      expect(conversations.ingestInbound).not.toHaveBeenCalled();
    });
  });

  describe('verifySubscription', () => {
    it('echoes the challenge in dev mode (no client configured)', () => {
      const out = service.verifySubscription({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'whatever',
        'hub.challenge': 'echo-me',
      });
      expect(out).toBe('echo-me');
    });
  });

  describe('verifySignature', () => {
    it('returns true when WHATSAPP_APP_SECRET is unset', () => {
      delete process.env.WHATSAPP_APP_SECRET;
      const local = new WhatsAppInboxService(conversations as never);
      expect(local.verifySignature('{}', undefined)).toBe(true);
    });
  });
});
