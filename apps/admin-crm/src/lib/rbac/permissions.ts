import type { Permission } from '@ac/types';

import { getAccessToken } from '@/lib/api/auth-token';

const PERMISSION_VERSION_KEY = 'ac:permission-version';

export interface SessionClaims {
  roles: string[];
  permissions: Permission[];
  permissionVersion: number;
}

export function readSessionClaims(): SessionClaims {
  const token = getAccessToken();
  if (!token) return { roles: [], permissions: [], permissionVersion: 0 };
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? '')) as {
      roles?: string[];
      permissions?: Permission[];
      pv?: number;
    };
    return {
      roles: payload.roles ?? [],
      permissions: payload.permissions ?? [],
      permissionVersion: payload.pv ?? 0,
    };
  } catch {
    return { roles: [], permissions: [], permissionVersion: 0 };
  }
}

export function setStoredPermissionVersion(version: number): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(PERMISSION_VERSION_KEY, String(version));
}

export function getStoredPermissionVersion(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(PERMISSION_VERSION_KEY);
  return raw ? Number(raw) : null;
}

/** True when server RBAC revision is ahead of the JWT `pv` claim. */
export function isPermissionVersionStale(serverVersion: number): boolean {
  const { permissionVersion } = readSessionClaims();
  return serverVersion > permissionVersion;
}

export function hasPermission(required: Permission, granted: Permission[]): boolean {
  if (granted.includes('*' as Permission)) return true;
  return granted.includes(required);
}

export function hasAnyPermission(required: Permission[], granted: Permission[]): boolean {
  return required.some((p) => hasPermission(p, granted));
}

export function hasAllPermissions(required: Permission[], granted: Permission[]): boolean {
  return required.every((p) => hasPermission(p, granted));
}
