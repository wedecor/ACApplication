import { apiFetch, type PaginatedResponse } from '@/lib/api/client';

export type NotificationLogStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'RETRYING'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | 'DLQ';

export type NotificationLogChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP' | 'IN_APP';

export interface NotificationLogItem {
  id: string;
  channel: NotificationLogChannel;
  template: string;
  status: NotificationLogStatus;
  correlationId: string | null;
  recipientPhone: string | null;
  recipientEmail: string | null;
  retryCount: number;
  maxRetries: number;
  failureReason: string | null;
  provider: string | null;
  providerRef: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface NotificationDeliveryEvent {
  id: string;
  status: NotificationLogStatus;
  provider: string | null;
  detail: string | null;
  createdAt: string;
}

export interface NotificationDashboard {
  queue: {
    main: QueueStats;
    dlq: QueueStats;
  };
  providers: Array<{
    channel: NotificationLogChannel;
    provider: string;
    snapshot: { state: string; failures: number };
  }>;
  killSwitch: boolean;
}

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export const notificationsApi = {
  list: (params?: {
    status?: NotificationLogStatus;
    channel?: NotificationLogChannel;
    search?: string;
    page?: number;
  }) =>
    apiFetch<PaginatedResponse<NotificationLogItem>>('/notifications', {
      query: params,
    }),

  timeline: (id: string) =>
    apiFetch<{ notification: NotificationLogItem | null; events: NotificationDeliveryEvent[] }>(
      `/notifications/${id}/timeline`,
    ),

  dashboard: () => apiFetch<NotificationDashboard>('/notifications/admin/dashboard'),

  retry: (id: string) =>
    apiFetch<{ id: string; status: string }>(`/notifications/${id}/retry`, { method: 'POST' }),

  retryDlq: (jobId: string) =>
    apiFetch<void>(`/notifications/admin/dlq/${jobId}/retry`, { method: 'POST' }),

  listDlq: () =>
    apiFetch<
      Array<{ id: string; notificationId: string; correlationId?: string; failedReason?: string }>
    >('/notifications/admin/dlq'),
};
