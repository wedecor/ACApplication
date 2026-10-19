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

interface TenantLookupDelegate {
  findFirst(args: { where: { id: string; tenantId: string }; select: { id: true } }): Promise<{ id: string } | null>;
}

/**
 * Foreign keys taken from a request body must point at rows in the caller's
 * tenant; otherwise `connect: { id }` would happily link another tenant's row.
 * Each check is [prisma model, id (skipped when empty), label for the 404].
 */
export async function assertIdsInTenant(
  client: unknown,
  tenantId: string,
  checks: ReadonlyArray<readonly [model: string, id: string | null | undefined, label: string]>,
): Promise<void> {
  const delegates = client as Record<string, TenantLookupDelegate | undefined>;
  await Promise.all(
    checks.map(async ([model, id, label]) => {
      if (!id) return;
      const row = await delegates[model]?.findFirst({ where: { id, tenantId }, select: { id: true } });
      if (!row) throw new NotFoundException(`${label} not found`);
    }),
  );
}
