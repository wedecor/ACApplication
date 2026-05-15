/**
 * Tenant-scoped sequential numbering for finance documents.
 *
 * The naïve approach `COUNT(*) + 1` is racy and produces duplicates under
 * load. We instead grab a Postgres **transaction-level advisory lock**
 * keyed on `(tenantId, prefix)`, look up the highest existing number that
 * matches our `YYYY-` window, and increment.
 *
 * The lock auto-releases at COMMIT, so a 1-minute slow render of a PDF
 * doesn't block the entire invoice table.
 */

import type { PrismaService } from '../prisma/prisma.service';

// Numbering uses the underlying Prisma client's $transaction for SQL-level
// advisory locks. The `PrismaService` thin wrapper exposes that as
// `.client.$transaction`.

export interface NumberGenOptions {
  /** "INV", "QTN", "CN" etc. */
  prefix: string;
  /** Year segment override (defaults to current year). */
  year?: number;
  /** Width of the trailing counter — defaults to 6 → 000123. */
  width?: number;
  /** Prisma model that has a unique `number` column. */
  table: 'invoice' | 'quotation' | 'creditNote' | 'amcSubscription' | 'technicianPayout';
}

const ADVISORY_NAMESPACE = 0x46_49_4e_45; // "FINE"

function stableHash(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export async function nextDocumentNumber(
  prisma: PrismaService,
  tenantId: string,
  opts: NumberGenOptions,
): Promise<string> {
  const year = opts.year ?? new Date().getUTCFullYear();
  const width = opts.width ?? 6;
  const prefix = `${opts.prefix}-${year}-`;

  // Advisory lock is transaction-scoped; we wrap our work in a tx.
  return prisma.client.$transaction(async (tx) => {
    const lockKey = stableHash(`${tenantId}:${opts.prefix}:${year}`);
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(${ADVISORY_NAMESPACE}::bigint, ${lockKey}::bigint)`,
    );

    const model = (tx as unknown as Record<string, { findFirst: Function }>)[opts.table];
    if (!model) throw new Error(`Unknown numbering model: ${opts.table}`);
    const latest = (await model.findFirst({
      where: { tenantId, number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    })) as { number: string } | null;

    let seq = 1;
    if (latest?.number) {
      const tail = latest.number.slice(prefix.length);
      const parsed = Number.parseInt(tail, 10);
      if (Number.isFinite(parsed)) seq = parsed + 1;
    }
    return `${prefix}${seq.toString().padStart(width, '0')}`;
  });
}
