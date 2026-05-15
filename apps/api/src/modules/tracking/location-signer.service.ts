import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * HMAC-SHA256 signing for technician GPS pings.
 *
 * The technician app is provisioned with a per-device key on first login and
 * signs every ping as `HMAC(secret, deviceId|technicianId|lat|lng|recordedAt)`.
 * The server rejects any ping whose signature mismatches or whose `recordedAt`
 * drifts > MAX_CLOCK_SKEW_MS to defeat replay attacks.
 *
 * Signed location updates are mandatory in production but optional in dev
 * (when no `locationSignKey` exists on the technician row).
 */
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

@Injectable()
export class LocationSigner {
  static buildPayload(input: {
    technicianId: string;
    deviceId: string;
    latitude: number;
    longitude: number;
    recordedAt: string;
  }): string {
    return [
      input.deviceId,
      input.technicianId,
      // Round to 6 decimals to align with mobile precision and avoid signature
      // mismatches caused by JSON serialisation.
      input.latitude.toFixed(6),
      input.longitude.toFixed(6),
      input.recordedAt,
    ].join('|');
  }

  sign(secret: string, payload: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  verify(secret: string, payload: string, signature: string): boolean {
    if (!signature) return false;
    const expected = this.sign(secret, payload);
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  /** Drift between device clock and server clock — > 5 min = reject as replay. */
  isFreshTimestamp(recordedAt: string): boolean {
    const t = Date.parse(recordedAt);
    if (Number.isNaN(t)) return false;
    return Math.abs(Date.now() - t) <= MAX_CLOCK_SKEW_MS;
  }
}
