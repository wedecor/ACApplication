/**
 * Signed, non-guessable tokens for the public "rate your visit" link sent in
 * review requests. The token binds a booking id to an HMAC so knowing (or
 * guessing) a booking id is not enough to rate it.
 *
 * Format: base64url(bookingId) "." base64url(HMAC-SHA256(key, bookingId))[0..22]
 * The key is derived from the server secret with a purpose label, so the same
 * secret can't be replayed to forge other kinds of tokens.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const PURPOSE = 'rating-link:v1';
const SIG_LENGTH = 22; // ~128 bits of base64url

function signature(secret: string, bookingId: string): string {
  const key = createHmac('sha256', secret).update(PURPOSE).digest();
  return createHmac('sha256', key).update(bookingId).digest('base64url').slice(0, SIG_LENGTH);
}

export function signRatingToken(secret: string, bookingId: string): string {
  return `${Buffer.from(bookingId, 'utf8').toString('base64url')}.${signature(secret, bookingId)}`;
}

/** The booking id when the token is authentic, otherwise null. */
export function verifyRatingToken(secret: string, token: string): string | null {
  const [idPart, sig] = token.split('.');
  if (!idPart || sig?.length !== SIG_LENGTH) return null;
  const bookingId = Buffer.from(idPart, 'base64url').toString('utf8');
  if (!bookingId || bookingId.length > 64) return null;
  const expected = Buffer.from(signature(secret, bookingId));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given) ? bookingId : null;
}
