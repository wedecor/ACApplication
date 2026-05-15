import { NotificationChannel } from '@ac/types';

import { ProviderHealthService } from '../provider-health.service';

describe('ProviderHealthService', () => {
  const redis = {
    default: {
      get: jest.fn(),
      set: jest.fn(),
      keys: jest.fn().mockResolvedValue([]),
    },
  };

  const env = {
    NOTIFICATION_CIRCUIT_FAILURE_THRESHOLD: 2,
    NOTIFICATION_CIRCUIT_OPEN_MS: 60_000,
  };

  let service: ProviderHealthService;

  beforeEach(() => {
    jest.clearAllMocks();
    let stored: string | null = null;
    redis.default.get.mockImplementation(() => Promise.resolve(stored));
    redis.default.set.mockImplementation((_key: string, value: string) => {
      stored = value;
      return Promise.resolve('OK');
    });
    service = new ProviderHealthService(redis as never, env as never);
  });

  it('opens circuit after failure threshold', async () => {
    await service.recordFailure(NotificationChannel.SMS, 'twilio');
    await service.recordFailure(NotificationChannel.SMS, 'twilio');
    expect(redis.default.set).toHaveBeenCalledWith(
      expect.stringContaining('twilio'),
      expect.stringContaining('"state":"open"'),
      'EX',
      expect.any(Number),
    );
    const open = await service.isAvailable(NotificationChannel.SMS, 'twilio');
    expect(open).toBe(false);
  });
});
