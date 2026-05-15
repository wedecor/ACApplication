import { createHmac, timingSafeEqual } from 'node:crypto';

import { UnauthorizedException } from '@nestjs/common';

export function verifyHmacSha256(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string | undefined,
  opts?: { prefix?: string; allowDevSkip?: boolean },
): boolean {
  if (!secret) {
    if (opts?.allowDevSkip && process.env['NODE_ENV'] !== 'production') {
      return true;
    }
    return false;
  }
  if (!signatureHeader) return false;

  const prefix = opts?.prefix ?? '';
  const provided = signatureHeader.startsWith(prefix)
    ? signatureHeader.slice(prefix.length)
    : signatureHeader;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}

export function assertWebhookAuth(ok: boolean, provider: string): void {
  if (!ok) {
    throw new UnauthorizedException(`Invalid ${provider} webhook signature`);
  }
}

export function verifyBearerSecret(
  authorization: string | undefined,
  secret: string | undefined,
): boolean {
  if (!secret || !authorization?.startsWith('Bearer ')) return false;
  const provided = authorization.slice('Bearer '.length);
  try {
    return timingSafeEqual(Buffer.from(secret), Buffer.from(provided));
  } catch {
    return false;
  }
}
