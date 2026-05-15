import { type JWTPayload, jwtVerify, SignJWT } from 'jose';
import ms from 'ms';

import type {
  AccessTokenPayload,
  AnyTokenPayload,
  RefreshTokenPayload,
  TokenPair,
} from '../types';

export interface TokenServiceOptions {
  accessSecret: string;
  refreshSecret: string;
  /** Access token TTL — accepts ms-style string e.g. "15m". */
  accessTtl: string;
  /** Refresh token TTL — e.g. "30d". */
  refreshTtl: string;
  issuer: string;
  audience: string;
}

/**
 * JWT issuer/verifier using HS256. For multi-region deployments switch to
 * RS256/EdDSA with a JWKS endpoint (the API can opt-in without changes to
 * downstream consumers).
 */
export class TokenService {
  private readonly accessKey: Uint8Array;
  private readonly refreshKey: Uint8Array;
  private readonly accessTtlMs: number;
  private readonly refreshTtlMs: number;

  constructor(private readonly opts: TokenServiceOptions) {
    this.accessKey = new TextEncoder().encode(opts.accessSecret);
    this.refreshKey = new TextEncoder().encode(opts.refreshSecret);
    this.accessTtlMs = ms(opts.accessTtl);
    this.refreshTtlMs = ms(opts.refreshTtl);
  }

  async issueTokens(
    base: Omit<AccessTokenPayload, 'typ'>,
    refreshJti: string,
  ): Promise<TokenPair> {
    const now = Date.now();
    const access = await new SignJWT({ ...base, typ: 'access' } satisfies AccessTokenPayload as unknown as JWTPayload)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(this.opts.issuer)
      .setAudience(this.opts.audience)
      .setIssuedAt(Math.floor(now / 1000))
      .setExpirationTime(Math.floor((now + this.accessTtlMs) / 1000))
      .sign(this.accessKey);

    const refreshPayload: RefreshTokenPayload = {
      sub: base.sub,
      tid: base.tid,
      sid: base.sid,
      jti: refreshJti,
      typ: 'refresh',
    };
    const refresh = await new SignJWT(refreshPayload as unknown as JWTPayload)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(this.opts.issuer)
      .setAudience(this.opts.audience)
      .setIssuedAt(Math.floor(now / 1000))
      .setExpirationTime(Math.floor((now + this.refreshTtlMs) / 1000))
      .sign(this.refreshKey);

    return {
      accessToken: access,
      refreshToken: refresh,
      accessTokenExpiresAt: new Date(now + this.accessTtlMs),
      refreshTokenExpiresAt: new Date(now + this.refreshTtlMs),
    };
  }

  async verifyAccess(token: string): Promise<AccessTokenPayload & { iat: number; exp: number }> {
    const { payload } = await jwtVerify<AccessTokenPayload>(token, this.accessKey, {
      issuer: this.opts.issuer,
      audience: this.opts.audience,
    });
    if (payload.typ !== 'access') throw new Error('Wrong token type');
    return payload as AccessTokenPayload & { iat: number; exp: number };
  }

  async verifyRefresh(
    token: string,
  ): Promise<RefreshTokenPayload & { iat: number; exp: number }> {
    const { payload } = await jwtVerify<RefreshTokenPayload>(token, this.refreshKey, {
      issuer: this.opts.issuer,
      audience: this.opts.audience,
    });
    if (payload.typ !== 'refresh') throw new Error('Wrong token type');
    return payload as RefreshTokenPayload & { iat: number; exp: number };
  }

  /** Decode without verification — for debugging only. Never trust the result. */
  decodeUnsafe(token: string): AnyTokenPayload | null {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    try {
      return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
    } catch {
      return null;
    }
  }
}
