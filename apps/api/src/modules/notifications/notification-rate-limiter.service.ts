import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { LoadedServerEnv } from '@ac/config';

import { APP_CONFIG } from '../../common/config/config.module';
import { RedisService } from '../../common/redis/redis.service';

const KILL_KEY_GLOBAL = 'notif:kill:switch';
const killKeyForTenant = (tenantId: string) => `notif:kill:switch:${tenantId}`;
const STORM_KEY = 'notif:storm:minute';

@Injectable()
export class NotificationRateLimiterService {
  constructor(
    private readonly redis: RedisService,
    @Inject(APP_CONFIG) private readonly env: LoadedServerEnv,
  ) {}

  async assertDispatchAllowed(opts: {
    tenantId: string;
    userId?: string;
    template: string;
    ip?: string;
  }): Promise<void> {
    if (this.env.NOTIFICATION_KILL_SWITCH) {
      throw new HttpException('Notification dispatch disabled (kill switch)', HttpStatus.SERVICE_UNAVAILABLE);
    }
    const [globalKill, tenantKill] = await Promise.all([
      this.redis.default.get(KILL_KEY_GLOBAL),
      this.redis.default.get(killKeyForTenant(opts.tenantId)),
    ]);
    if (globalKill === '1' || tenantKill === '1') {
      throw new HttpException('Notification dispatch disabled (kill switch)', HttpStatus.SERVICE_UNAVAILABLE);
    }

    await this.assertStormLimit();

    if (opts.template === 'auth.otp' || opts.template.startsWith('auth.')) {
      await this.assertLimit(`notif:rl:otp:${opts.userId ?? opts.ip ?? 'anon'}`, this.env.NOTIFICATION_OTP_RATE_LIMIT_PER_HOUR, 3600);
    }

    if (opts.userId) {
      await this.assertLimit(
        `notif:rl:user:${opts.userId}`,
        this.env.NOTIFICATION_USER_RATE_LIMIT_PER_HOUR,
        3600,
      );
    }

    if (opts.ip) {
      await this.assertLimit(`notif:rl:ip:${opts.ip}`, this.env.NOTIFICATION_OTP_RATE_LIMIT_PER_HOUR * 2, 3600);
    }
  }

  async setKillSwitch(tenantId: string, enabled: boolean): Promise<void> {
    const key = killKeyForTenant(tenantId);
    if (enabled) {
      await this.redis.default.set(key, '1');
    } else {
      await this.redis.default.del(key);
    }
  }

  async setGlobalKillSwitch(enabled: boolean): Promise<void> {
    if (enabled) {
      await this.redis.default.set(KILL_KEY_GLOBAL, '1');
    } else {
      await this.redis.default.del(KILL_KEY_GLOBAL);
    }
  }

  async isKillSwitchActive(tenantId: string): Promise<boolean> {
    if (this.env.NOTIFICATION_KILL_SWITCH) return true;
    const [globalKill, tenantKill] = await Promise.all([
      this.redis.default.get(KILL_KEY_GLOBAL),
      this.redis.default.get(killKeyForTenant(tenantId)),
    ]);
    return globalKill === '1' || tenantKill === '1';
  }

  private async assertStormLimit(): Promise<void> {
    const minute = Math.floor(Date.now() / 60_000);
    const key = `${STORM_KEY}:${minute}`;
    const count = await this.redis.default.incr(key);
    if (count === 1) await this.redis.default.expire(key, 120);
    if (count > this.env.NOTIFICATION_STORM_LIMIT_PER_MINUTE) {
      throw new HttpException('Notification storm protection triggered', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async assertLimit(key: string, max: number, ttlSeconds: number): Promise<void> {
    const count = await this.redis.default.incr(key);
    if (count === 1) await this.redis.default.expire(key, ttlSeconds);
    if (count > max) {
      throw new HttpException('Notification rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
