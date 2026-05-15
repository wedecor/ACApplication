import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/api/query-keys';
import { type TechnicianStatus, trackingApi } from '@/lib/api/tracking';

export function useLiveMap(params: { cityId?: string; status?: TechnicianStatus[] } = {}) {
  return useQuery({
    queryKey: queryKeys.tracking.liveMap(params),
    queryFn: () => trackingApi.liveMap(params),
    // The realtime socket pushes deltas; this is the cold-start fetch +
    // safety-net refetch every 30s in case we drop a frame.
    refetchInterval: 30_000,
  });
}

export function useTechnicianHistory(technicianId: string | null, sinceMinutes = 120) {
  return useQuery({
    queryKey: technicianId
      ? queryKeys.tracking.history(technicianId, sinceMinutes)
      : ['tracking', 'history', 'noop'],
    queryFn: () => (technicianId ? trackingApi.history(technicianId, sinceMinutes) : Promise.resolve([])),
    enabled: !!technicianId,
  });
}

export function useAvailability(cityId: string | null) {
  return useQuery({
    queryKey: queryKeys.tracking.availability(cityId),
    queryFn: () => trackingApi.availability(cityId),
    refetchInterval: 20_000,
  });
}
