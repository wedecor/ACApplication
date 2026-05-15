import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notificationsApi } from '@/api/endpoints';
import { qk } from '@/api/keys';

import { useRealtimeEvent } from './use-realtime';
import { RealtimeEvents } from '@/lib/realtime';

export function useNotifications() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: qk.notifications(),
    queryFn: () => notificationsApi.list(),
    staleTime: 15_000,
  });
  useRealtimeEvent(RealtimeEvents.notification, () => {
    qc.invalidateQueries({ queryKey: qk.notifications() });
  });
  return q;
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifications() }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifications() }),
  });
}
