/**
 * Tenant-scoped sequential numbering for repair documents:
 *   - Warranty claims  → WC-2026-000123
 *   - Workshop jobs    → WS-2026-000123
 *
 * Same pattern as `common/support/numbering.ts`: a transaction-scoped
 * Postgres advisory lock keyed on (tenant, prefix, year) serialises
 * concurrent writers. `nextRepairNumberTx` runs inside a caller's
 * transaction (so the lock is held until the row is inserted).
 */
import type { Prisma } from '@ac/database';

import type { PrismaService } from '../../../common/prisma/prisma.service';

const ADVISORY_NAMESPACE = 0x52_45_50_52; // "REPR"

export type RepairNumberPrefix = 'WC' | 'WS';

const TABLE_BY_PREFIX: Record<RepairNumberPrefix, 'warrantyClaim' | 'workshopJob'> = {
  WC: 'warrantyClaim',
  WS: 'workshopJob',
};

function stableHash(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  // pg_advisory_xact_lock(int4, int4): keep the key a non-negative int4.
  return h & 0x7fffffff;
}

/** Format helper — exported for tests. */
export function formatRepairNumber(
  prefix: RepairNumberPrefix,
  year: number,
  seq: number,
  width = 6,
): string {
  return `${prefix}-${year}-${seq.toString().padStart(width, '0')}`;
}

/** Next sequence given the highest existing number (or null). */
export function nextSequence(latest: string | null | undefined, prefixWithYear: string): number {
  if (!latest?.startsWith(prefixWithYear)) return 1;
  const parsed = Number.parseInt(latest.slice(prefixWithYear.length), 10);
  return Number.isFinite(parsed) ? parsed + 1 : 1;
}

export async function nextRepairNumberTx(
  tx: Prisma.TransactionClient,
  prefix: RepairNumberPrefix,
  year: number = new Date().getUTCFullYear(),
): Promise<string> {
  // Numbers are globally unique columns, so the counter is global per prefix/year.
  const lockKey = stableHash(`${prefix}:${year}`);
  await tx.$executeRawUnsafe(
    `SELECT pg_advisory_xact_lock(${ADVISORY_NAMESPACE}::int, ${lockKey}::int)`,
  );
  const head = `${prefix}-${year}-`;
  const where = { number: { startsWith: head } };
  const latest =
    TABLE_BY_PREFIX[prefix] === 'warrantyClaim'
      ? await tx.warrantyClaim.findFirst({ where, orderBy: { number: 'desc' }, select: { number: true } })
      : await tx.workshopJob.findFirst({ where, orderBy: { number: 'desc' }, select: { number: true } });
  return formatRepairNumber(prefix, year, nextSequence(latest?.number, head));
}

export function nextRepairNumber(
  prisma: PrismaService,
  prefix: RepairNumberPrefix,
): Promise<string> {
  return prisma.client.$transaction((tx) => nextRepairNumberTx(tx as Prisma.TransactionClient, prefix));
}
