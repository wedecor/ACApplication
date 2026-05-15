import { createHash, randomInt } from 'node:crypto';

export interface OtpOptions {
  length?: number;
  /** Salt used when hashing the code for storage. */
  pepper?: string;
}

/**
 * OTP generation & verification. Codes are zero-padded numeric strings.
 * We store a salted SHA-256 hash; never persist the raw code.
 */
export const otp = {
  generate(opts: OtpOptions = {}): string {
    const length = opts.length ?? 6;
    const max = 10 ** length;
    const value = randomInt(0, max);
    return value.toString().padStart(length, '0');
  },

  hash(code: string, pepper = ''): string {
    return createHash('sha256').update(`${pepper}:${code}`).digest('hex');
  },

  verify(code: string, hash: string, pepper = ''): boolean {
    return timingSafeEqualStr(this.hash(code, pepper), hash);
  },
};

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
