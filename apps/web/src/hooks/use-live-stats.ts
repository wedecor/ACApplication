'use client';

import { useQuery } from '@tanstack/react-query';

import { env } from '@/env';
import { fetchPublicStats, type PublicStats } from '@/lib/public-api';

/**
 * Live "social proof" counters — bookings today, technicians online.
 *
 * We poll a cached endpoint every 30s rather than open a websocket from
 * every public visitor; the realtime gateway is for authenticated CRM /
 * technician traffic. Polling at 30s with `revalidate=60` on the
 * backend keeps egress tiny.
 */
export function useLiveStats(initial?: PublicStats) {
  return useQuery<PublicStats>({
    queryKey: ['public-stats'],
    queryFn: () => fetchPublicStats({ revalidate: 30 }),
    initialData: initial,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 25_000,
    enabled: Boolean(env.NEXT_PUBLIC_API_URL),
  });
}
