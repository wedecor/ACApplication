/**
 * Tenant-scoped sequential numbering for support documents (tickets,
 * call-logs). Delegates to the shared atomic counter in `common/numbering`.
 */
import { allocateDocumentNumber } from '../numbering/document-sequence';
import type { PrismaService } from '../prisma/prisma.service';

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
  return allocateDocumentNumber(prisma, tenantId, opts);
}
