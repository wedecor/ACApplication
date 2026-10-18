/**
 * Tenant-scoped sequential numbering for finance documents.
 * Delegates to the shared atomic counter in `common/numbering`.
 */

import { allocateDocumentNumber } from '../numbering/document-sequence';
import type { PrismaService } from '../prisma/prisma.service';

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

export async function nextDocumentNumber(
  prisma: PrismaService,
  tenantId: string,
  opts: NumberGenOptions,
): Promise<string> {
  return allocateDocumentNumber(prisma, tenantId, opts);
}
