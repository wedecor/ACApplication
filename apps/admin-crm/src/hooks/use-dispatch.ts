import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { dispatchApi } from '@/lib/api/dispatch';
import { queryKeys } from '@/lib/api/query-keys';

export function useUnassignedQueue(cityId: string | null) {
  return useQuery({
    queryKey: queryKeys.dispatch.unassigned(cityId),
    queryFn: () => dispatchApi.unassigned(cityId),
    refetchOnWindowFocus: false,
    staleTime: 10_000,
  });
}

export function useDispatchRecommendations(bookingId: string | null) {
  return useQuery({
    queryKey: bookingId ? queryKeys.dispatch.recommendations(bookingId) : ['dispatch', 'recs', 'noop'],
    queryFn: () => (bookingId ? dispatchApi.recommendations(bookingId) : Promise.resolve([])),
    enabled: !!bookingId,
  });
}

export function useDispatchAlerts(cityId: string | null) {
  return useQuery({
    queryKey: queryKeys.dispatch.alerts(cityId),
    queryFn: () => dispatchApi.alerts(cityId),
    refetchInterval: 30_000,
  });
}

export function useRecentDecisions(cityId: string | null) {
  return useQuery({
    queryKey: queryKeys.dispatch.recentDecisions(cityId),
    queryFn: () => dispatchApi.recentDecisions(cityId),
    refetchInterval: 15_000,
  });
}

export function useAutoAssign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) => dispatchApi.autoAssign(bookingId),
    onSuccess: (_data, bookingId) => {
      toast.success('Technician auto-assigned');
      void qc.invalidateQueries({ queryKey: ['dispatch'] });
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.detail(bookingId) });
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.all });
    },
    onError: (err: Error) => toast.error(err.message ?? 'Auto-assign failed'),
  });
}

export function useManualAssign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { bookingId: string; technicianId: string; reason?: string }) =>
      dispatchApi.manualAssign(input),
    onSuccess: (_data, vars) => {
      toast.success('Technician assigned');
      void qc.invalidateQueries({ queryKey: ['dispatch'] });
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.detail(vars.bookingId) });
    },
    onError: (err: Error) => toast.error(err.message ?? 'Assignment failed'),
  });
}

export function useReassign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { bookingId: string; toTechnicianId?: string; autoPick?: boolean; reason?: string }) =>
      dispatchApi.reassign(input),
    onSuccess: (_d, vars) => {
      toast.success('Technician reassigned');
      void qc.invalidateQueries({ queryKey: ['dispatch'] });
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.detail(vars.bookingId) });
    },
    onError: (err: Error) => toast.error(err.message ?? 'Reassign failed'),
  });
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      dispatchApi.acknowledgeAlert(id, note),
    onSuccess: () => {
      toast.success('Alert acknowledged');
      void qc.invalidateQueries({ queryKey: ['dispatch', 'alerts'] });
    },
  });
}
