import { NotificationChannel } from '@ac/types';
import { sendWithFailover, type NamedProvider } from '@ac/notifications';
import { ConsoleTransport } from '@ac/notifications';

describe('sendWithFailover', () => {
  it('falls back to secondary provider when primary fails', async () => {
    const primary: NamedProvider = {
      name: 'primary',
      priority: 1,
      transport: {
        channel: NotificationChannel.SMS,
        send: async () => ({ channel: NotificationChannel.SMS, status: 'failed', error: 'down' }),
      },
    };
    const secondary: NamedProvider = {
      name: 'secondary',
      priority: 2,
      transport: new ConsoleTransport(NotificationChannel.SMS),
    };

    const result = await sendWithFailover([primary, secondary], {
      channel: NotificationChannel.SMS,
      recipient: { phone: '+919999999999' },
      message: { template: 'test', channel: NotificationChannel.SMS, text: 'hi' },
      isProviderAvailable: async () => true,
      onProviderSuccess: async () => {},
      onProviderFailure: async () => {},
    });

    expect(result.status).toBe('sent');
    expect(result.provider).toBe('secondary');
  });
});
