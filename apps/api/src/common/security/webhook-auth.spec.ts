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
