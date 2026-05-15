'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { captureAttribution, Events, track } from '@/lib/analytics';

/**
 * Fires a `page_view` event on every client-side navigation. Mount once
 * in the root `<Providers>`. We also persist any incoming UTM / gclid
 * params so the booking funnel can attribute the lead.
 */
export function AnalyticsRouteTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(searchParams.toString());
    captureAttribution(params);
    track(Events.PageView, {
      path: pathname ?? '',
      search: params.toString(),
    });
  }, [pathname, searchParams]);

  return null;
}
