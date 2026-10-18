/**
 * Tenant-scoped sequential document numbers (INV-2026-000123, TKT-2026-000045 …).
 *
 * Each (tenant, prefix, year) has a counter row in `document_sequences`. The
 * next value comes from a single `INSERT … ON CONFLICT DO UPDATE … RETURNING`,
 * which Postgres serialises on the row lock, so concurrent writers can never
 * receive the same number — unlike reading the latest number and adding one,
 * where two requests can both read "41" before either inserts "42".
 *
 * The first allocation for a window is seeded from the highest number already
 * stored in the document table, and `GREATEST` keeps the counter ahead of any
 * row written by other means. Numbers burned by a rolled-back insert leave a
 * gap; they are never reissued.
 */
import type { PrismaService } from '../prisma/prisma.service';

/** Prisma delegates whose rows carry `tenantId` + a sequential `number`. */
export type NumberedTable =
  | 'invoice'
  | 'quotation'
  | 'creditNote'
  | 'amcSubscription'
  | 'technicianPayout'
  | 'supportTicket'
  | 'callLog'
  | 'purchaseOrder'
  | 'goodsReceipt'
  | 'stockTransfer';

export interface DocumentNumberOptions {
  /** "INV", "QTN", "TKT" … */
  prefix: string;
  /** Prisma model holding the documents (used to seed a new counter). */
  table: NumberedTable;
  /** Year segment override (defaults to the current UTC year). */
  year?: number;
  /** Width of the zero-padded counter (default 6 → 000123). */
  width?: number;
}

interface NumberLookup {
  findFirst(args: {
    where: { tenantId: string; number: { startsWith: string } };
    orderBy: { number: 'desc' };
    select: { number: true };
  }): Promise<{ number: string } | null>;
}

/** Highest sequence already used for `prefix` (e.g. "INV-2026-"), or 0. */
export function sequenceFromNumber(latest: string | null | undefined, prefix: string): number {
  if (!latest?.startsWith(prefix)) return 0;
  const parsed = Number.parseInt(latest.slice(prefix.length), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function formatDocumentNumber(prefix: string, year: number, seq: number, width = 6): string {
  return `${prefix}-${year}-${seq.toString().padStart(width, '0')}`;
}

export async function allocateDocumentNumber(
  prisma: PrismaService,
  tenantId: string,
  opts: DocumentNumberOptions,
): Promise<string> {
  const year = opts.year ?? new Date().getUTCFullYear();
  const windowPrefix = `${opts.prefix}-${year}-`;

  return prisma.client.$transaction(async (tx) => {
    const model = (tx as unknown as Record<string, NumberLookup | undefined>)[opts.table];
    if (!model) throw new TypeError(`Unknown numbering model: ${opts.table}`);
    const latest = await model.findFirst({
      where: { tenantId, number: { startsWith: windowPrefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const seed = sequenceFromNumber(latest?.number, windowPrefix) + 1;

    const rows = await tx.$queryRaw<{ lastValue: number }[]>`
      INSERT INTO "document_sequences" ("tenantId", "prefix", "year", "lastValue", "createdAt", "updatedAt")
      VALUES (${tenantId}, ${opts.prefix}, ${year}, ${seed}, now(), now())
      ON CONFLICT ("tenantId", "prefix", "year") DO UPDATE
        SET "lastValue" = GREATEST("document_sequences"."lastValue" + 1, EXCLUDED."lastValue"),
            "updatedAt" = now()
      RETURNING "lastValue"`;
    const seq = rows[0]?.lastValue;
    if (seq == null) throw new TypeError('Document sequence allocation returned no row');
    return formatDocumentNumber(opts.prefix, year, seq, opts.width);
  });
}
