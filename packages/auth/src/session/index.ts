import { createHash, randomBytes } from 'node:crypto';

/**
 * Refresh tokens are persisted as salted SHA-256 hashes (not encrypted) so
 * we can compare in constant time without revealing the value at rest.
 */
export const session = {
  /** Generate a cryptographically random opaque id (43 base64url chars). */
  newId(): string {
    return randomBytes(32).toString('base64url');
  },

  hashRefresh(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  },
};
