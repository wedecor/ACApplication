'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getAccessToken, getRefreshToken } from '@/lib/api/auth-token';

/**
 * Redirects unauthenticated users to /login. Public auth routes are excluded.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getAccessToken() ?? getRefreshToken();
    if (!token) {
      const next = encodeURIComponent(pathname || '/');
      router.replace(`/login?next=${next}`);
      return;
    }
    setReady(true);
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Checking session…
      </div>
    );
  }

  return <>{children}</>;
}
