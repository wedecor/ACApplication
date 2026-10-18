/**
 * HMAC-SHA256 (RFC 2104) on top of a SHA-256 digest function, because
 * expo-crypto exposes `digest()` but no HMAC. Pure: the digest is injected,
 * so the construction is unit-tested against Node's own HMAC.
 */
export type Sha256 = (data: Uint8Array) => Promise<ArrayBuffer>;

const BLOCK_SIZE = 64;
const encoder = new TextEncoder();

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

export function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Hex HMAC-SHA256 of `message` under `secret` — matches Node's createHmac('sha256'). */
export async function hmacSha256Hex(secret: string, message: string, sha256: Sha256): Promise<string> {
  let key = encoder.encode(secret);
  if (key.length > BLOCK_SIZE) key = new Uint8Array(await sha256(key));
  const padded = new Uint8Array(BLOCK_SIZE);
  padded.set(key);
  const ipad = padded.map((b) => b ^ 0x36);
  const opad = padded.map((b) => b ^ 0x5c);
  const inner = new Uint8Array(await sha256(concat(ipad, encoder.encode(message))));
  return toHex(await sha256(concat(opad, inner)));
}
