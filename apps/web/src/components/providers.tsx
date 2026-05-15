'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import * as React from 'react';
import { Suspense } from 'react';

import { AnalyticsRouteTracker } from '@/components/analytics/route-tracker';

export function Providers({ children }: { children: React.ReactNode }) {
  // One QueryClient per tab; SSR-safe via the `useState` lazy initializer.
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={client}>
        {/*
          AnalyticsRouteTracker uses `useSearchParams`, which forces a
          dynamic boundary. We wrap in Suspense so static pages stay
          statically rendered.
        */}
        <Suspense fallback={null}>
          <AnalyticsRouteTracker />
        </Suspense>
        {children}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
