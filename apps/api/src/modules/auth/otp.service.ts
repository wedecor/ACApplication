import { randomUUID } from 'node:crypto';

import { otp } from '@ac/auth';
import type { LoadedServerEnv } from '@ac/config';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';

import { APP_CONFIG } from '../../common/config/config.module';
import { RedisService } from '../../common/redis/redis.service';

const NS = 'auth:otp';

/**
 * OTP issuance + verification. Codes are hashed before storage; raw codes
 * are only ever passed to the SMS/WhatsApp transport.
 *
 * Storage layout in Redis (per destination):
 *   auth:otp:{dest}          -> JSON { hash, purpose, issueId } (TTL = OTP_TTL_SECONDS)
 *   auth:otp:issued:{dest}   -> codes issued in the current window (TTL = lock window)
 *   auth:otp:fails:{dest}    -> verify attempts in the current window (TTL = lock window)
 *
 * Brute-force bounds: an attempt is *reserved* (atomic INCR) before the code is
 * compared, so parallel guesses can't exceed OTP_MAX_ATTEMPTS; the counter is
 * not reset when a new code is issued, and issuing is itself capped per window.
 */
@Injectable()
export class OtpService {
  constructor(
    private readonly redis: RedisService,
    @Inject(APP_CONFIG) private readonly env: LoadedServerEnv,
  ) {}

  async issue(
    destination: string,
    purpose = 'LOGIN',
  ): Promise<{ code: string; ttlSeconds: number; issueId: string }> {
    const issued = await this.bump(`${NS}:issued:${destination}`);
    if (issued > this.env.OTP_ISSUE_LIMIT) {
      throw new HttpException('Too many codes requested. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const code = otp.generate({ length: this.env.OTP_LENGTH });
    const issueId = randomUUID();
    const ttl = this.env.OTP_TTL_SECONDS;
    await this.redis.default.set(
      `${NS}:${destination}`,
      JSON.stringify({ hash: otp.hash(code, this.env.JWT_SECRET), purpose, issueId }),
      'EX',
      ttl,
    );
    return { code, ttlSeconds: ttl, issueId };
  }

  /** True only for the current, unexpired code issued for `purpose`. Single use. */
  async verify(destination: string, code: string, purpose = 'LOGIN'): Promise<boolean> {
    const key = `${NS}:${destination}`;
    const failsKey = `${NS}:fails:${destination}`;

    // Reserve the attempt first so concurrent guesses are all counted.
    const attempts = await this.bump(failsKey);
    if (attempts > this.env.OTP_MAX_ATTEMPTS) {
      await this.redis.default.del(key);
      return false;
    }

    const raw = await this.redis.default.get(key);
    if (!raw) return false;
    const entry = JSON.parse(raw) as { hash: string; purpose?: string };
    if ((entry.purpose ?? 'LOGIN') !== purpose) return false;
    if (!otp.verify(code, entry.hash, this.env.JWT_SECRET)) {
      if (attempts >= this.env.OTP_MAX_ATTEMPTS) await this.redis.default.del(key);
      return false;
    }

    await this.redis.default.del(key, failsKey);
    return true;
  }

  /** INCR with the lock-window TTL set on first use. */
  private async bump(key: string): Promise<number> {
    const count = await this.redis.default.incr(key);
    if (count === 1) await this.redis.default.expire(key, this.env.OTP_LOCK_WINDOW_SECONDS);
    return count;
  }
}
