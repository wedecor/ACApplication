import { apiFetch, type PaginatedResponse } from '@/lib/api/client';

export type WorkflowInstanceStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'WAITING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'ESCALATED';

export interface WorkflowInstanceItem {
  id: string;
  definitionKey: string;
  definitionVer: number;
  correlationId: string;
  status: WorkflowInstanceStatus;
  currentStepKey: string | null;
  resourceType: string | null;
  resourceId: string | null;
  failureReason: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowTimelineEvent {
  id: string;
  eventType: string;
  detail: string | null;
  stepKey: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface WorkflowAnalytics {
  periodDays: number;
  total: number;
  successRate: number;
  failureRate: number;
  escalations: number;
  stuckWorkflows: number;
  avgStepAttempts: number;
  byStatus: Array<{ status: WorkflowInstanceStatus; count: number }>;
}

export const orchestrationApi = {
  listWorkflows: (params?: { status?: WorkflowInstanceStatus; page?: number; pageSize?: number }) =>
    apiFetch<PaginatedResponse<WorkflowInstanceItem>>('/orchestration/workflows', { query: params }),

  timeline: (id: string) =>
    apiFetch<{ instance: WorkflowInstanceItem | null; events: WorkflowTimelineEvent[] }>(
      `/orchestration/workflows/${id}/timeline`,
    ),

  analytics: () => apiFetch<WorkflowAnalytics>('/orchestration/analytics'),

  pause: (id: string) =>
    apiFetch<void>(`/orchestration/workflows/${id}/pause`, { method: 'POST' }),

  resume: (id: string) =>
    apiFetch<void>(`/orchestration/workflows/${id}/resume`, { method: 'POST' }),

  cancel: (id: string) =>
    apiFetch<void>(`/orchestration/workflows/${id}/cancel`, { method: 'POST' }),
};
