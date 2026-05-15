/**
 * Tenant-scoped sequential numbering for support documents (tickets,
 * call-logs). Mirrors the pattern used by the finance module — each
 * counter uses a Postgres transaction-scoped advisory lock keyed on
 * `(tenantId, prefix, year)` so concurrent writers serialise safely
 * without holding a long lock.
 */
import type { PrismaService } from '../prisma/prisma.service';

const ADVISORY_NAMESPACE = 0x53_55_50_50; // "SUPP"

function stableHash(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export interface SupportNumberOptions {
  prefix: 'TKT' | 'CALL';
  table: 'supportTicket' | 'callLog';
  year?: number;
  width?: number;
}

export async function nextSupportNumber(
  prisma: PrismaService,
  tenantId: string,
  opts: SupportNumberOptions,
): Promise<string> {
  const year = opts.year ?? new Date().getUTCFullYear();
  const width = opts.width ?? 6;
  const prefix = `${opts.prefix}-${year}-`;

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
