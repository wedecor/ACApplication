import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  notificationsApi,
  type NotificationLogChannel,
  type NotificationLogStatus,
} from '@/lib/api/notifications';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (filters: {
    status?: NotificationLogStatus;
    channel?: NotificationLogChannel;
    search?: string;
  }) => [...notificationKeys.all, 'list', filters] as const,
  dashboard: () => [...notificationKeys.all, 'dashboard'] as const,
  timeline: (id: string) => [...notificationKeys.all, 'timeline', id] as const,
  dlq: () => [...notificationKeys.all, 'dlq'] as const,
};

export function useNotifications(filters: {
  status?: NotificationLogStatus;
  channel?: NotificationLogChannel;
  search?: string;
}) {
  return useQuery({
    queryKey: notificationKeys.list(filters),
    queryFn: () => notificationsApi.list(filters),
  });
}

export function useNotificationDashboard() {
  return useQuery({
    queryKey: notificationKeys.dashboard(),
    queryFn: () => notificationsApi.dashboard(),
    refetchInterval: 15_000,
  });
}

export function useNotificationTimeline(id: string | null) {
  return useQuery({
    queryKey: notificationKeys.timeline(id ?? ''),
    queryFn: () => notificationsApi.timeline(id!),
    enabled: Boolean(id),
  });
}

export function useDlqJobs() {
  return useQuery({
    queryKey: notificationKeys.dlq(),
    queryFn: () => notificationsApi.listDlq(),
    refetchInterval: 15_000,
  });
}

export function useRetryNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.retry(id),
    onSuccess: () => {
      toast.success('Notification re-queued');
      void qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRetryDlq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => notificationsApi.retryDlq(jobId),
    onSuccess: () => {
      toast.success('DLQ job re-queued');
      void qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
