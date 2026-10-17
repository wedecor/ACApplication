import { Permission, UserRole } from '@ac/types';

/**
 * Pure RBAC policy helpers used by the staff-user and role admin services.
 * Kept free of Prisma/Nest so they can be unit-tested exhaustively.
 */

export const WILDCARD = Permission.ALL as string;

/** Permissions an admin may never strip from themselves (would lock them out). */
export const SELF_PROTECTED_PERMISSIONS: readonly string[] = [
  Permission.USER_MANAGE,
  Permission.ROLE_MANAGE,
];

/** Roles whose permission set can never be edited through the API. */
export const IMMUTABLE_ROLE_KEYS: readonly UserRole[] = [UserRole.SUPER_ADMIN];

/**
 * Roles that are tied to a domain profile and therefore managed by their own
 * modules (technicians onboarding, customer sign-up) — not via staff admin.
 */
export const PROFILE_MANAGED_ROLE_KEYS: readonly UserRole[] = [UserRole.TECHNICIAN, UserRole.CUSTOMER];

export interface RolePermissionsLike {
  key: string;
  permissions: readonly string[];
}

export function effectivePermissions(roles: readonly RolePermissionsLike[]): Set<string> {
  const out = new Set<string>();
  for (const r of roles) for (const p of r.permissions) out.add(p);
  return out;
}

export function holds(granted: ReadonlySet<string> | readonly string[], key: string): boolean {
  const set = granted instanceof Set ? granted : new Set(granted as readonly string[]);
  return set.has(WILDCARD) || set.has(key);
}

/**
 * Anti-escalation: an actor may only hand out permissions they hold
 * themselves. Returns the keys the actor is NOT allowed to grant.
 */
export function ungrantablePermissions(
  actorPermissions: ReadonlySet<string> | readonly string[],
  requested: readonly string[],
): string[] {
  return [...new Set(requested)].filter((k) => k === WILDCARD || !holds(actorPermissions, k));
}

/** Protected permissions held `before` that would be lost `after`. */
export function lostSelfProtectedPermissions(
  before: ReadonlySet<string>,
  after: ReadonlySet<string>,
): string[] {
  return SELF_PROTECTED_PERMISSIONS.filter((k) => holds(before, k) && !holds(after, k));
}

/**
 * Effective permissions of a user after swapping one role's permission set
 * (used to stop an admin editing a role they hold into a lock-out).
 */
export function permissionsAfterRoleEdit(
  userRoles: readonly RolePermissionsLike[],
  editedRoleKey: string,
  nextPermissions: readonly string[],
): Set<string> {
  return effectivePermissions(
    userRoles.map((r) => (r.key === editedRoleKey ? { key: r.key, permissions: nextPermissions } : r)),
  );
}

export interface PermissionDefinitionLike {
  key: string;
  resource: string;
  action: string;
  description: string | null;
}

export interface PermissionGroup<T extends PermissionDefinitionLike> {
  resource: string;
  permissions: T[];
}

/** Groups permission definitions by resource; stable alphabetical order. */
export function groupPermissionsByResource<T extends PermissionDefinitionLike>(
  defs: readonly T[],
): PermissionGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const d of defs) {
    if (d.key === WILDCARD) continue;
    const list = map.get(d.resource) ?? [];
    list.push(d);
    map.set(d.resource, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([resource, permissions]) => ({
      resource,
      permissions: [...permissions].sort((a, b) => a.key.localeCompare(b.key)),
    }));
}

/** Set-equality on permission key lists (order/duplicates ignored). */
export function samePermissionSet(a: readonly string[], b: readonly string[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const k of sa) if (!sb.has(k)) return false;
  return true;
}
