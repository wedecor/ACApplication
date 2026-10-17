import type { Prisma } from '@prisma/client';

/**
 * Increments `Tenant.rbacVersion`, which invalidates every access JWT whose
 * `pv` claim is older (JwtAuthGuard → PERMISSIONS_STALE → client refresh).
 * Always call inside the same transaction as the role/permission mutation.
 */
export async function bumpTenantRbacVersion(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<number> {
  const updated = await tx.tenant.update({
    where: { id: tenantId },
    data: { rbacVersion: { increment: 1 } },
    select: { rbacVersion: true },
  });
  return updated.rbacVersion;
}
