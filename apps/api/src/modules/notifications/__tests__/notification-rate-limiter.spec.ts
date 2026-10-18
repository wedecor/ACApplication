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

  it('keys the OTP limit on the destination, not a shared anonymous bucket', async () => {
    redis.default.incr.mockResolvedValue(1);
    await limiter.assertDispatchAllowed({ tenantId: 't1', destination: '+919000000001', template: 'auth.otp' });
    expect(redis.default.incr).toHaveBeenCalledWith('notif:rl:otp:+919000000001');
    expect(redis.default.incr.mock.calls.flat()).not.toContain('notif:rl:otp:anon');
  });

  it('counts storms per tenant', async () => {
    redis.default.incr.mockResolvedValue(1);
    await limiter.assertDispatchAllowed({ tenantId: 't9', userId: 'u1', template: 'booking.confirmed' });
    expect(redis.default.incr.mock.calls.map((c) => c[0] as string).some((k) => k.startsWith('notif:storm:minute:t9:'))).toBe(true);
  });

  it('refuses an OTP with no recipient to key on', async () => {
    await expect(limiter.assertDispatchAllowed({ tenantId: 't1', template: 'auth.otp' })).rejects.toMatchObject({ status: 400 });
  });
});
