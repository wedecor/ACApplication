import {
  assertRegistryValid,
  ROLE_PERMISSIONS,
  SEED_PERMISSIONS,
  SYSTEM_ROLE_KEYS,
  validateRegistry,
} from '@ac/auth';
import type { RbacConsistencyReport, RbacSyncStats } from '@ac/auth';
import type { PrismaClient, UserRole } from '@prisma/client';

export interface RbacSyncOptions {
  /** Delete DB permissions not in registry when they have no role assignments. */
  removeOrphanPermissions?: boolean;
  /** Increment tenant.rbacVersion when mappings change (invalidates JWTs). */
  bumpVersionOnChange?: boolean;
}

export interface RbacSyncResult {
  tenantId: string;
  changed: boolean;
  rbacVersion: number;
  stats: RbacSyncStats;
}

function prettyRoleName(role: UserRole): string {
  return role
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Upserts permissions from the code registry and reconciles system role mappings
 * for one tenant. DB is authoritative at runtime; registry is the desired state.
 */
export async function syncPermissionsFromSeed(
  prisma: PrismaClient,
  tenantId: string,
  options: RbacSyncOptions = {},
): Promise<RbacSyncResult> {
  assertRegistryValid();

  const bumpVersionOnChange = options.bumpVersionOnChange ?? true;
  const removeOrphanPermissions = options.removeOrphanPermissions ?? false;

  const stats: RbacSyncStats = {
    permissionsUpserted: 0,
    permissionsDeprecated: 0,
    rolesSynced: 0,
    roleAssignmentsAdded: 0,
    roleAssignmentsRemoved: 0,
    rbacVersionBumped: false,
  };

  let changed = false;

  for (const p of SEED_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { description: p.description, resource: p.resource, action: p.action },
      create: p,
    });
    stats.permissionsUpserted += 1;
  }

  const registryKeys = new Set(SEED_PERMISSIONS.map((p) => p.key));

  for (const roleKey of SYSTEM_ROLE_KEYS) {
    const role = await prisma.role.upsert({
      where: { tenantId_key: { tenantId, key: roleKey } },
      update: {},
      create: {
        tenantId,
        key: roleKey,
        name: prettyRoleName(roleKey),
        description: `System role: ${roleKey}`,
        isSystem: true,
      },
    });
    stats.rolesSynced += 1;

    const desiredKeys = [...new Set(ROLE_PERMISSIONS[roleKey])];
    const permRows = await prisma.permission.findMany({
      where: { key: { in: desiredKeys } },
    });

    if (permRows.length !== desiredKeys.length) {
      const found = new Set(permRows.map((p) => p.key));
      const missing = desiredKeys.filter((k) => !found.has(k));
      throw new Error(
        `RBAC sync: role ${roleKey} references permissions missing from DB: ${missing.join(', ')}`,
      );
    }

    const existing = await prisma.rolePermission.findMany({
      where: { roleId: role.id },
      include: { permission: true },
    });
    const desiredIds = new Set(permRows.map((p) => p.id));
    const existingIds = new Set(existing.map((e) => e.permissionId));

    const toRemove = existing.filter((e) => !desiredIds.has(e.permissionId));
    if (toRemove.length > 0) {
      await prisma.rolePermission.deleteMany({
        where: { roleId: role.id, permissionId: { in: toRemove.map((e) => e.permissionId) } },
      });
      stats.roleAssignmentsRemoved += toRemove.length;
      changed = true;
    }

    const toAdd = permRows.filter((p) => !existingIds.has(p.id));
    if (toAdd.length > 0) {
      await prisma.rolePermission.createMany({
        data: toAdd.map((p) => ({ roleId: role.id, permissionId: p.id })),
        skipDuplicates: true,
      });
      stats.roleAssignmentsAdded += toAdd.length;
      changed = true;
    }
  }

  if (removeOrphanPermissions) {
    const orphans = await prisma.permission.findMany({
      where: { key: { notIn: [...registryKeys] } },
      include: { roles: true },
    });
    for (const orphan of orphans) {
      if (orphan.roles.length > 0) {
        await prisma.rolePermission.deleteMany({ where: { permissionId: orphan.id } });
        stats.roleAssignmentsRemoved += orphan.roles.length;
        changed = true;
      }
      await prisma.permission.delete({ where: { id: orphan.id } });
      stats.permissionsDeprecated += 1;
      changed = true;
    }
  }

  let rbacVersion = 1;
  if (changed && bumpVersionOnChange) {
    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: { rbacVersion: { increment: 1 } },
      select: { rbacVersion: true },
    });
    rbacVersion = updated.rbacVersion;
    stats.rbacVersionBumped = true;
  } else {
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { rbacVersion: true },
    });
    rbacVersion = tenant.rbacVersion;
  }

  return { tenantId, changed, rbacVersion, stats };
}

/** Read-only consistency check: registry vs database. */
export async function auditRbacConsistency(
  prisma: PrismaClient,
  tenantId?: string,
): Promise<RbacConsistencyReport> {
  const registryValidation = validateRegistry();
  const registryKeys = new Set(SEED_PERMISSIONS.map((p) => p.key));

  const dbPermissions = await prisma.permission.findMany({ select: { key: true } });
  const dbKeys = dbPermissions.map((p) => p.key);
  const dbKeySet = new Set(dbKeys);

  const missingInDb = [...registryKeys].filter((k) => !dbKeySet.has(k));
  const orphanInDb = dbKeys.filter((k) => !registryKeys.has(k));

  const counts = new Map<string, number>();
  for (const k of dbKeys) counts.set(k, (counts.get(k) ?? 0) + 1);
  const duplicateInDb = [...counts.entries()].filter(([, n]) => n > 1).map(([k]) => k);

  const tenants = tenantId
    ? await prisma.tenant.findMany({ where: { id: tenantId }, select: { id: true, slug: true, rbacVersion: true } })
    : await prisma.tenant.findMany({
        where: { deletedAt: null },
        select: { id: true, slug: true, rbacVersion: true },
      });

  const staleRoles: RbacConsistencyReport['staleRoles'] = [];

  for (const tenant of tenants) {
    for (const roleKey of SYSTEM_ROLE_KEYS) {
      const role = await prisma.role.findUnique({
        where: { tenantId_key: { tenantId: tenant.id, key: roleKey } },
        include: { permissions: { include: { permission: true } } },
      });
      if (!role) {
        staleRoles.push({
          roleKey,
          tenantId: tenant.id,
          missingAssignments: [...ROLE_PERMISSIONS[roleKey]],
          extraAssignments: [],
        });
        continue;
      }

      const desired = new Set(ROLE_PERMISSIONS[roleKey]);
      const actual = new Set(role.permissions.map((rp) => rp.permission.key));
      const missingAssignments = [...desired].filter((k) => !actual.has(k));
      const extraAssignments = [...actual].filter((k) => !desired.has(k));
      if (missingAssignments.length || extraAssignments.length) {
        staleRoles.push({
          roleKey,
          tenantId: tenant.id,
          missingAssignments,
          extraAssignments,
        });
      }
    }
  }

  const inSync =
    registryValidation.valid &&
    missingInDb.length === 0 &&
    duplicateInDb.length === 0 &&
    staleRoles.length === 0;

  return {
    inSync,
    registryPermissionCount: registryKeys.size,
    dbPermissionCount: dbKeys.length,
    missingInDb,
    orphanInDb,
    duplicateInDb,
    staleRoles,
    rbacVersionByTenant: tenants.map((t) => ({
      tenantId: t.id,
      slug: t.slug,
      rbacVersion: t.rbacVersion,
    })),
  };
}

export async function syncAllTenantRbac(
  prisma: PrismaClient,
  options?: RbacSyncOptions,
): Promise<RbacSyncResult[]> {
  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });
  const results: RbacSyncResult[] = [];
  for (const tenant of tenants) {
    results.push(await syncPermissionsFromSeed(prisma, tenant.id, options));
  }
  return results;
}
