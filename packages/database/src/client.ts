import { Prisma, PrismaClient } from '@prisma/client';

import { withAudit } from './audit';
import { withSoftDelete } from './soft-delete';

/**
 * Strongly-typed factory that builds a PrismaClient extended with:
 *   * soft-delete (filters out `deletedAt != null` rows on read; rewrites
 *     `delete*` calls to `update*` with `deletedAt = now()`).
 *   * audit logging (writes to `audit_log` for selected mutations).
 *
 * Always go through this factory — never `new PrismaClient()` directly.
 */
export interface CreatePrismaOptions {
  /** Override Prisma log levels per environment. */
  log?: Prisma.LogLevel[];
  /** Inject the current actor for audit-trail rows. */
  getActor?: () => { userId?: string | null; tenantId?: string | null } | null;
  /** Disable soft-delete (e.g. for housekeeping scripts). */
  disableSoftDelete?: boolean;
  /** Disable audit logging (e.g. for seed scripts). */
  disableAudit?: boolean;
}

export type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

export function createPrismaClient(options: CreatePrismaOptions = {}) {
  const base = new PrismaClient({
    log:
      options.log ??
      (process.env['NODE_ENV'] === 'production'
        ? (['error', 'warn'] as Prisma.LogLevel[])
        : (['warn', 'error'] as Prisma.LogLevel[])),
  });

  let client: PrismaClient = base;
  if (!options.disableSoftDelete) client = withSoftDelete(client) as unknown as PrismaClient;
  if (!options.disableAudit && options.getActor) {
    client = withAudit(client, options.getActor) as unknown as PrismaClient;
  }
  return client;
}

/**
 * Process-wide singleton — Next.js/NestJS hot-reload friendly.
 */
declare global {
  // eslint-disable-next-line no-var
  var __ac_prisma__: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__ac_prisma__ ?? createPrismaClient();

if (process.env['NODE_ENV'] !== 'production') {
  globalThis.__ac_prisma__ = prisma;
}

export { Prisma };
