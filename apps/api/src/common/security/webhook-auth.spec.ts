import { verifyBearerSecret, verifyHmacSha256 } from './webhook-auth';

describe('webhook-auth', () => {
  it('verifies bearer secret', () => {
    expect(verifyBearerSecret('Bearer secret-1', 'secret-1')).toBe(true);
    expect(verifyBearerSecret('Bearer wrong', 'secret-1')).toBe(false);
  });

  it('verifies hmac when secret configured', () => {
    const body = '{"ok":true}';
    const secret = 'test-secret';
    const crypto = require('node:crypto');
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyHmacSha256(body, sig, secret)).toBe(true);
  });
});

describe('verifyHmacSha256 without a secret', () => {
  const prev = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = prev;
  });

  it('fails closed on staging even when dev skip is allowed', () => {
    process.env.NODE_ENV = 'staging';
    expect(verifyHmacSha256('{}', undefined, undefined, { allowDevSkip: true })).toBe(false);
  });

  it('skips only in local development', () => {
    process.env.NODE_ENV = 'development';
    expect(verifyHmacSha256('{}', undefined, undefined, { allowDevSkip: true })).toBe(true);
  });
});
