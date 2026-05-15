import { NotificationChannel } from '@prisma/client';

import { NotificationRepository } from '../notification.repository';

describe('NotificationRepository', () => {
  const prisma = {
    client: {
      notificationTemplate: {
        findFirst: jest.fn(),
      },
    },
  };

  let repo: NotificationRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new NotificationRepository(prisma as never);
  });

  describe('buildMessage', () => {
    it('renders template variables when a row exists', async () => {
      prisma.client.notificationTemplate.findFirst.mockResolvedValue({
        subject: 'Hello',
        body: 'Code {{code}} for {{name}}',
      });

      const msg = await repo.buildMessage(
        'auth.otp',
        NotificationChannel.SMS,
        { code: '123456', name: 'Rahul' },
      );

      expect(msg.text).toBe('Code 123456 for Rahul');
      expect(msg.subject).toBe('Hello');
    });

    it('falls back to the template key when no row exists', async () => {
      prisma.client.notificationTemplate.findFirst.mockResolvedValue(null);

      const msg = await repo.buildMessage('missing.template', NotificationChannel.SMS, {});

      expect(msg.text).toBe('missing.template');
    });
  });
});
