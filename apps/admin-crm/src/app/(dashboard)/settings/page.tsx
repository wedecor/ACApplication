'use client';

import { useRouter } from 'next/navigation';
import { LogOut, Settings } from 'lucide-react';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@ac/ui';

import { clearAuthTokens } from '@/lib/api/auth-token';

export default function SettingsPage() {
  const router = useRouter();

  function signOut() {
    clearAuthTokens();
    router.replace('/login');
  }

  return (
    <section className="mx-auto max-w-lg space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Settings className="size-5" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">Session and workspace preferences.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sign out of the admin CRM on this browser. You will need to verify OTP again to sign
            back in.
          </p>
          <Button variant="destructive" onClick={signOut}>
            <LogOut className="size-4" />
            Sign out
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Environment</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>API: {process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}</p>
          <p className="mt-2">
            Role and permission changes take effect on the next API request after database seed or
            admin updates — no need to clear tokens manually.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
