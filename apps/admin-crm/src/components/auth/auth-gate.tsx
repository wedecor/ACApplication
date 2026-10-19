'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getAccessToken } from '@/lib/api/auth-token';
import { refreshAccessToken } from '@/lib/api/client';

/**
 * Redirects unauthenticated users to /login. Public auth routes are excluded.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      // A new tab has no access token yet; the httpOnly refresh cookie may still hold a session.
      const token = getAccessToken() ?? (await refreshAccessToken());
      if (!live) return;
      if (!token) {
        const next = encodeURIComponent(pathname || '/');
        router.replace(`/login?next=${next}`);
        return;
      }
      setReady(true);
    })();
    return () => {
      live = false;
    };
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
