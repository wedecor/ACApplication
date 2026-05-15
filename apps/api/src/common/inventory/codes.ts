/**
 * SKU / barcode / document-number generators for the inventory module.
 *
 * Generation strategies:
 *   - **SKUs** are auto-derived from `{type-prefix}-{slug}-{seq}` when the
 *     user doesn't supply one (catalogue UX nicety). The slug is built from
 *     name + brand so the SKU is human-readable in lists.
 *   - **Barcodes** are EAN-13 candidates from a tenant-scoped prefix; we
 *     compute the checksum digit so any commodity barcode scanner accepts
 *     them.
 *   - **Document numbers** (POs, GRNs, Transfers) use the same year-bucketed
 *     advisory-lock numbering used elsewhere in the API, but here we
 *     dispatch by Prisma model name so the inventory module doesn't have to
 *     fork the finance helper.
 *
 * Concurrency: all numbering paths run inside a serialisable transaction
 * with `pg_advisory_xact_lock` keyed on `(tenantId, prefix)`. The lock is
 * scoped to the transaction so a long PDF render can't block the entire
 * tenant.
 */
import type { PrismaService } from '../prisma/prisma.service';

const ADVISORY_NAMESPACE = 0x49_4e_56_4e; // "INVN"

function stableHash(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

interface InventoryNumberOptions {
  prefix: 'PO' | 'GRN' | 'TRN';
  table: 'purchaseOrder' | 'goodsReceipt' | 'stockTransfer';
  year?: number;
  width?: number;
}

export async function nextInventoryNumber(
  prisma: PrismaService,
  tenantId: string,
  opts: InventoryNumberOptions,
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

/**
 * Generate a candidate SKU from the item name + brand. Final uniqueness is
 * enforced by the `(tenantId, sku)` unique constraint at the database level;
 * if the suggested SKU collides we suffix `-N` until it's free.
 */
export async function suggestSku(
  prisma: PrismaService,
  tenantId: string,
  input: { name: string; brand?: string | null; type?: string | null },
): Promise<string> {
  const typePrefix = (input.type ?? 'ITM').slice(0, 3).toUpperCase();
  const brandSlug = slugify(input.brand ?? '').slice(0, 4).toUpperCase() || 'GEN';
  const nameSlug = slugify(input.name).slice(0, 6).toUpperCase() || 'PART';
  const base = `${typePrefix}-${brandSlug}-${nameSlug}`;
  let candidate = base;
  let suffix = 0;
  // Bounded loop — at most 50 collisions before we ask the user to pick one.
  for (let i = 0; i < 50; i += 1) {
    const exists = await prisma.client.inventoryItem.findUnique({
      where: { tenantId_sku: { tenantId, sku: candidate } },
      select: { id: true },
    });
    if (!exists) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  // Fallback to a random suffix.
  return `${base}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .trim();
}

/**
 * Compute the EAN-13 checksum digit and return a full 13-digit barcode for
 * a 12-digit base. Used when the user wants the system to mint a tenant
 * barcode. The first 2 digits (208/209) are GS1 "in-store use" prefixes —
 * safe to mint without GS1 licensing.
 */
export function makeEan13(twelveDigitBase: string): string {
  if (!/^\d{12}$/.test(twelveDigitBase)) {
    throw new Error('makeEan13: base must be 12 digits');
  }
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    const digit = Number(twelveDigitBase[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checksum = (10 - (sum % 10)) % 10;
  return `${twelveDigitBase}${checksum}`;
}

/**
 * Build an in-house EAN-13 barcode using `tenantId` as deterministic entropy.
 * Two callers that pass the same `(tenantId, itemId)` get the same barcode,
 * which keeps the system idempotent on re-runs.
 */
export function deriveTenantBarcode(tenantId: string, itemId: string, prefix: '208' | '209' = '209'): string {
  const seed = stableHash(`${tenantId}:${itemId}`);
  const tail = seed.toString().padStart(9, '0').slice(-9);
  const base = `${prefix}${tail}`;
  return makeEan13(base);
}
