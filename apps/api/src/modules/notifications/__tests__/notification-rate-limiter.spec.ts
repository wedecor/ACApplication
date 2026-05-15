import { NotificationRateLimiterService } from '../notification-rate-limiter.service';

describe('NotificationRateLimiterService', () => {
  const redis = {
    default: {
      get: jest.fn().mockResolvedValue(null),
      incr: jest.fn(),
      expire: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    },
  };

  const env = {
    NOTIFICATION_KILL_SWITCH: false,
    NOTIFICATION_OTP_RATE_LIMIT_PER_HOUR: 2,
    NOTIFICATION_USER_RATE_LIMIT_PER_HOUR: 100,
    NOTIFICATION_STORM_LIMIT_PER_MINUTE: 1000,
  };

  let limiter: NotificationRateLimiterService;

  beforeEach(() => {
    jest.clearAllMocks();
    limiter = new NotificationRateLimiterService(redis as never, env as never);
  });

  it('blocks when OTP rate limit exceeded', async () => {
    redis.default.incr.mockResolvedValue(3);
    await expect(
      limiter.assertDispatchAllowed({
        tenantId: 't1',
        userId: 'u1',
        template: 'auth.otp',
      }),
    ).rejects.toMatchObject({ status: 429 });
  });
});
