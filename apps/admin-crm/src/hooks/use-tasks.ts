'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/api/query-keys';
import { type TaskInput, type TaskListQuery, tasksApi } from '@/lib/api/tasks';

export function useTasks(query: TaskListQuery) {
  return useQuery({
    queryKey: queryKeys.tasks.list(query as Record<string, unknown>),
    queryFn: () => tasksApi.list(query),
    placeholderData: keepPreviousData,
  });
}

export function useTaskSummary() {
  return useQuery({ queryKey: queryKeys.tasks.summary, queryFn: () => tasksApi.summary() });
}

function useInvalidateTasks() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: queryKeys.tasks.all });
}

export function useSaveTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: TaskInput }) =>
      id ? tasksApi.update(id, input) : tasksApi.create(input),
    onSuccess: invalidate,
  });
}

export function useCompleteTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({ mutationFn: (id: string) => tasksApi.complete(id), onSuccess: invalidate });
}

export function useDeleteTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({ mutationFn: (id: string) => tasksApi.remove(id), onSuccess: invalidate });
}
