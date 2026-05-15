import { ForbiddenException, NotFoundException } from '@nestjs/common';

/**
 * Reusable tenant-scoping helpers — every tenant-owned row lookup should
 * include `tenantId` from the authenticated actor to prevent IDOR.
 */
export function tenantWhere(
  tenantId: string,
  extra?: Record<string, unknown>,
): { tenantId: string } & Record<string, unknown> {
  return { tenantId, ...extra };
}

export function assertTenantMatch(
  row: { tenantId: string } | null | undefined,
  actorTenantId: string,
  resourceLabel = 'Resource',
): asserts row is { tenantId: string } {
  if (!row) {
    throw new NotFoundException(`${resourceLabel} not found`);
  }
  if (row.tenantId !== actorTenantId) {
    throw new ForbiddenException(`${resourceLabel} not accessible`);
  }
}
