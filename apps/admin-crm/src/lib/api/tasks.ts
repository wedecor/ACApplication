import { apiFetch, type PaginatedResponse } from './client';

export const TASK_STATUSES = ['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export const TASK_ENTITY_TYPES = [
  'lead',
  'customer',
  'booking',
  'ticket',
  'opportunity',
  'account',
] as const;
export type TaskEntityType = (typeof TASK_ENTITY_TYPES)[number];

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  reminderAt: string | null;
  reminderSentAt: string | null;
  assigneeUserId: string | null;
  entityType: TaskEntityType | null;
  entityId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignee?: { id: string; firstName: string | null; lastName: string | null; email: string | null } | null;
}

export interface TaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueAt?: string | null;
  reminderAt?: string | null;
  assigneeUserId?: string;
  entityType?: TaskEntityType | null;
  entityId?: string | null;
}

export interface TaskListQuery {
  page?: number;
  pageSize?: number;
  scope?: 'mine' | 'all';
  status?: TaskStatus;
  overdue?: boolean;
  entityType?: TaskEntityType;
  entityId?: string;
  assigneeUserId?: string;
  search?: string;
}

export interface TaskSummary {
  open: number;
  overdue: number;
  dueToday: number;
  mineOpen: number;
}

export const tasksApi = {
  list: (query: TaskListQuery = {}) =>
    apiFetch<PaginatedResponse<Task>>('/tasks', { query: query as Record<string, unknown> }),
  summary: () => apiFetch<TaskSummary>('/tasks/summary'),
  get: (id: string) => apiFetch<Task>(`/tasks/${id}`),
  create: (input: TaskInput) => apiFetch<Task>('/tasks', { method: 'POST', body: input }),
  update: (id: string, input: Partial<TaskInput>) =>
    apiFetch<Task>(`/tasks/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => apiFetch<unknown>(`/tasks/${id}`, { method: 'DELETE' }),
  complete: (id: string) => apiFetch<Task>(`/tasks/${id}/complete`, { method: 'POST', body: {} }),
};
