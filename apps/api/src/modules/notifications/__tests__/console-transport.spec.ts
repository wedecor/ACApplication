import { serverEnvSchema } from '@ac/config';
import { ConsoleTransport } from '@ac/notifications';
import { NotificationChannel } from '@ac/types';

import { NotificationFailoverDispatcher } from '../notification-failover.dispatcher';

describe('Console transport protection in production', () => {
  const minimalValidProdEnv = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/ac_db',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'production-super-secret-jwt-signing-key-32-chars-min',
    JWT_REFRESH_SECRET: 'production-super-secret-refresh-token-key-32-chars-min',
    API_URL: 'https://api.example.com',
    WEB_URL: 'https://example.com',
    ADMIN_URL: 'https://admin.example.com',
    SMS_PROVIDER: 'msg91',
    MSG91_AUTH_KEY: 'msg91-mock-auth-key-value',
    MSG91_SENDER_ID: 'ACNOTF',
    EMAIL_PROVIDER: 'smtp',
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '587',
    SMTP_FROM: 'noreply@example.com',
    PUSH_PROVIDER: 'expo',
    EXPO_ACCESS_TOKEN: 'expo-token-sample',
  };

  describe('serverEnvSchema validation', () => {
    it('accepts a valid production config with real providers', () => {
      const result = serverEnvSchema.safeParse(minimalValidProdEnv);
      expect(result.success).toBe(true);
    });

    it('rejects SMS_PROVIDER=console in production', () => {
      const result = serverEnvSchema.safeParse({
        ...minimalValidProdEnv,
        SMS_PROVIDER: 'console',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('SMS_PROVIDER'));
        expect(issue).toBeDefined();
        expect(issue?.message).toBe('SMS_PROVIDER=console is not allowed in production');
      }
    });

    it('rejects EMAIL_PROVIDER=console in production', () => {
      const result = serverEnvSchema.safeParse({
        ...minimalValidProdEnv,
        EMAIL_PROVIDER: 'console',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('EMAIL_PROVIDER'));
        expect(issue).toBeDefined();
        expect(issue?.message).toBe('EMAIL_PROVIDER=console is not allowed in production');
      }
    });

    it('rejects PUSH_PROVIDER=console in production', () => {
      const result = serverEnvSchema.safeParse({
        ...minimalValidProdEnv,
        PUSH_PROVIDER: 'console',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.includes('PUSH_PROVIDER'));
        expect(issue).toBeDefined();
        expect(issue?.message).toBe('PUSH_PROVIDER=console is not allowed in production');
      }
    });

    it('allows console providers in non-production environments', () => {
      const devEnv = {
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/ac_db',
        REDIS_URL: 'redis://localhost:6379',
        JWT_SECRET: 'development-secret-that-is-at-least-32-chars-long',
        JWT_REFRESH_SECRET: 'development-refresh-secret-at-least-32-chars-long',
        API_URL: 'http://localhost:4000',
        WEB_URL: 'http://localhost:3000',
        ADMIN_URL: 'http://localhost:3001',
        NODE_ENV: 'development',
        SMS_PROVIDER: 'console',
        EMAIL_PROVIDER: 'console',
        PUSH_PROVIDER: 'console',
      };
      const result = serverEnvSchema.safeParse(devEnv);
      expect(result.success).toBe(true);
    });
  });

  describe('NotificationFailoverDispatcher in production', () => {
    it('does not register ConsoleTransport for email, push, or whatsapp in production', () => {
      const health = { isAvailable: jest.fn(), recordSuccess: jest.fn(), recordFailure: jest.fn() } as any;
      const metrics = { recordProviderLatency: jest.fn() } as any;
      const realtime = {} as any;
      const prodEnv = {
        ...minimalValidProdEnv,
        NODE_ENV: 'production',
        EMAIL_PROVIDER: 'smtp',
        // Omit actual SMTP host/port to simulate unconfigured email
        SMTP_HOST: undefined,
        SMTP_PORT: undefined,
        SMTP_FROM: undefined,
        PUSH_PROVIDER: 'console',
        EXPO_ACCESS_TOKEN: undefined,
        WHATSAPP_PHONE_NUMBER_ID: undefined,
      };

      const dispatcher = new NotificationFailoverDispatcher(health, metrics, realtime, prodEnv as any);
      dispatcher.onModuleInit();

      const providers = (dispatcher as any).providers as Map<NotificationChannel, any[]>;
      const emailProviders = providers.get(NotificationChannel.EMAIL) ?? [];
      const pushProviders = providers.get(NotificationChannel.PUSH) ?? [];
      const whatsappProviders = providers.get(NotificationChannel.WHATSAPP) ?? [];

      expect(emailProviders.some((p) => p.transport instanceof ConsoleTransport)).toBe(false);
      expect(pushProviders.some((p) => p.transport instanceof ConsoleTransport)).toBe(false);
      expect(whatsappProviders.some((p) => p.transport instanceof ConsoleTransport)).toBe(false);
    });
  });
});
