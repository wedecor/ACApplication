import { signRatingToken, verifyRatingToken } from '../rating-link';

const SECRET = 'test-secret-that-is-long-enough-000000';

describe('rating link tokens', () => {
  it('round-trips a booking id', () => {
    const token = signRatingToken(SECRET, 'demo_book_001');
    expect(verifyRatingToken(SECRET, token)).toBe('demo_book_001');
  });

  it('rejects a token for another booking with a copied signature', () => {
    const [, sig] = signRatingToken(SECRET, 'demo_book_001').split('.');
    const forged = `${Buffer.from('demo_book_002').toString('base64url')}.${sig}`;
    expect(verifyRatingToken(SECRET, forged)).toBeNull();
  });

  it('rejects tokens signed with a different secret or malformed input', () => {
    expect(verifyRatingToken(SECRET, signRatingToken('other-secret-000000000000000000', 'b1'))).toBeNull();
    expect(verifyRatingToken(SECRET, 'not-a-token')).toBeNull();
    expect(verifyRatingToken(SECRET, '')).toBeNull();
  });
});
