import bcrypt from 'bcryptjs';

const DEFAULT_ROUNDS = 12;

/**
 * Password helpers — bcrypt with sensible defaults. For higher-throughput
 * services swap to argon2id (Node native binding) without changing callers.
 */
export const password = {
  hash(plain: string, rounds = DEFAULT_ROUNDS): Promise<string> {
    return bcrypt.hash(plain, rounds);
  },
  verify(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  },
  /** Quick policy check. Apps should layer richer rules on top (haveibeenpwned, etc). */
  isStrong(plain: string): { ok: boolean; reasons: string[] } {
    const reasons: string[] = [];
    if (plain.length < 8) reasons.push('Must be at least 8 characters');
    if (!/[A-Z]/.test(plain)) reasons.push('Must include an uppercase letter');
    if (!/[a-z]/.test(plain)) reasons.push('Must include a lowercase letter');
    if (!/[0-9]/.test(plain)) reasons.push('Must include a digit');
    return { ok: reasons.length === 0, reasons };
  },
};
