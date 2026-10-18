import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { hmacSha256Hex } from '../hmac';

const sha256 = async (data: Uint8Array) => {
  const out = createHash('sha256').update(data).digest();
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
};

describe('hmacSha256Hex', () => {
  it('matches the server-side HMAC for a location payload', async () => {
    const payload = 'dev-1|tech_1|12.971600|77.594600|2026-10-18T09:00:00.000Z';
    await expect(hmacSha256Hex('sign-key', payload, sha256)).resolves.toBe(
      createHmac('sha256', 'sign-key').update(payload).digest('hex'),
    );
  });

  it('hashes keys longer than the block size first (RFC 2104)', async () => {
    const longKey = 'k'.repeat(100);
    await expect(hmacSha256Hex(longKey, 'msg', sha256)).resolves.toBe(
      createHmac('sha256', longKey).update('msg').digest('hex'),
    );
  });

  it('handles non-ASCII input as UTF-8', async () => {
    await expect(hmacSha256Hex('ключ', '₹ टेस्ट', sha256)).resolves.toBe(
      createHmac('sha256', 'ключ').update('₹ टेस्ट').digest('hex'),
    );
  });
});
