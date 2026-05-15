'use client';

import { Button } from '@ac/ui';
import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';

/**
 * Per-segment error boundary. Catches render-time errors from any dashboard
 * page and offers a soft retry without a hard reload.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard segment error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border bg-card p-8 text-center">
      <AlertTriangle className="size-10 text-destructive" />
      <h2 className="mt-4 text-lg font-semibold">Something went wrong</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {error.message || 'An unexpected error occurred. Try again, or reload the page.'}
      </p>
      <Button className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
