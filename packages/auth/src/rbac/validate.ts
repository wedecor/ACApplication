import { UserRole } from '@ac/types';

import { ROLE_PERMISSIONS, SEED_PERMISSIONS, SYSTEM_ROLE_KEYS } from './registry';

export interface RegistryValidationResult {
  valid: boolean;
  duplicatePermissionKeys: string[];
  unknownRolePermissionKeys: Array<{ role: string; key: string }>;
  missingSystemRoles: UserRole[];
  orphanRoleKeys: string[];
}

/** Validates the in-code registry before any DB sync. */
export function validateRegistry(): RegistryValidationResult {
  const duplicatePermissionKeys: string[] = [];
  const seen = new Set<string>();
  for (const p of SEED_PERMISSIONS) {
    if (seen.has(p.key)) duplicatePermissionKeys.push(p.key);
    seen.add(p.key);
  }

  const permissionKeys = new Set(SEED_PERMISSIONS.map((p) => p.key));
  const unknownRolePermissionKeys: Array<{ role: string; key: string }> = [];
  for (const [role, keys] of Object.entries(ROLE_PERMISSIONS)) {
    for (const key of keys) {
      if (key === '*') continue;
      if (!permissionKeys.has(key)) {
        unknownRolePermissionKeys.push({ role, key });
      }
    }
  }

  const registryRoles = new Set(SYSTEM_ROLE_KEYS);
  const missingSystemRoles = (Object.values(UserRole) as UserRole[]).filter(
    (r) => !registryRoles.has(r),
  );
  const orphanRoleKeys = [...registryRoles].filter(
    (r) => !(Object.values(UserRole) as string[]).includes(r),
  );

  const valid =
    duplicatePermissionKeys.length === 0 &&
    unknownRolePermissionKeys.length === 0 &&
    missingSystemRoles.length === 0 &&
    orphanRoleKeys.length === 0;

  return {
    valid,
    duplicatePermissionKeys,
    unknownRolePermissionKeys,
    missingSystemRoles,
    orphanRoleKeys,
  };
}

export function assertRegistryValid(): void {
  const result = validateRegistry();
  if (result.valid) return;
  const parts: string[] = [];
  if (result.duplicatePermissionKeys.length) {
    parts.push(`duplicate permission keys: ${result.duplicatePermissionKeys.join(', ')}`);
  }
  if (result.unknownRolePermissionKeys.length) {
    parts.push(
      `unknown role permission keys: ${result.unknownRolePermissionKeys
        .map((x) => `${x.role}:${x.key}`)
        .join(', ')}`,
    );
  }
  if (result.missingSystemRoles.length) {
    parts.push(`missing system roles: ${result.missingSystemRoles.join(', ')}`);
  }
  if (result.orphanRoleKeys.length) {
    parts.push(`orphan role keys: ${result.orphanRoleKeys.join(', ')}`);
  }
  throw new Error(`RBAC registry invalid — ${parts.join('; ')}`);
}
