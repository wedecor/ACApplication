'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';

import { apiFetch } from '@/lib/api/client';
import {
  hasAllPermissions,
  isPermissionVersionStale,
  readSessionClaims,
  setStoredPermissionVersion,
} from '@/lib/rbac/permissions';
import { permissionsForPath } from '@/lib/rbac/route-access';

/**
 * Enforces route-level RBAC using JWT permission claims (UI only — API remains authoritative).
 */
export function PermissionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const required = useMemo(() => permissionsForPath(pathname ?? '/'), [pathname]);
  const { permissions } = readSessionClaims();

  useEffect(() => {
    if (required.length > 0 && !hasAllPermissions(required, permissions)) {
      router.replace('/?unauthorized=1');
    }
  }, [required, permissions, router]);

  useEffect(() => {
    let cancelled = false;
    void apiFetch<{ permissionVersion: number }>('/users/me')
      .then((me) => {
        if (cancelled) return;
        setStoredPermissionVersion(me.permissionVersion);
        if (isPermissionVersionStale(me.permissionVersion)) {
          router.replace('/login?stale=permissions');
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (required.length > 0 && !hasAllPermissions(required, permissions)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        You do not have access to this page.
      </div>
    );
  }

  return <>{children}</>;
}
