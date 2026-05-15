import { Inject, Injectable } from '@nestjs/common';
import { otp } from '@ac/auth';
import type { LoadedServerEnv } from '@ac/config';

import { APP_CONFIG } from '../../common/config/config.module';
import { RedisService } from '../../common/redis/redis.service';

const NS = 'auth:otp';

/**
 * OTP issuance + verification. Codes are hashed before storage; raw codes
 * are only ever passed to the SMS/WhatsApp transport.
 *
 * Storage layout in Redis:
 *   auth:otp:{destination}            -> JSON { hash, expiresAt, purpose }
 *   auth:otp:attempts:{destination}   -> integer counter (with TTL)
 */
@Injectable()
export class OtpService {
  constructor(
    private readonly redis: RedisService,
    @Inject(APP_CONFIG) private readonly env: LoadedServerEnv,
  ) {}

  async issue(destination: string, purpose = 'LOGIN'): Promise<{ code: string; ttlSeconds: number }> {
    const code = otp.generate({ length: this.env.OTP_LENGTH });
    const hash = otp.hash(code, this.env.JWT_SECRET);
    const ttl = this.env.OTP_TTL_SECONDS;
    await this.redis.default.set(
      `${NS}:${destination}`,
      JSON.stringify({ hash, purpose, attempts: 0 }),
      'EX',
      ttl,
    );
    return { code, ttlSeconds: ttl };
  }

  async verify(destination: string, code: string): Promise<boolean> {
    const key = `${NS}:${destination}`;
    const raw = await this.redis.default.get(key);
    if (!raw) return false;

    const entry = JSON.parse(raw) as { hash: string; attempts: number };
    if (entry.attempts >= this.env.OTP_MAX_ATTEMPTS) {
      await this.redis.default.del(key);
      return false;
    }
    const ok = otp.verify(code, entry.hash, this.env.JWT_SECRET);
    if (!ok) {
      await this.redis.default.set(
        key,
        JSON.stringify({ ...entry, attempts: entry.attempts + 1 }),
        'KEEPTTL',
      );
      return false;
    }
    await this.redis.default.del(key);
    return true;
  }
}
