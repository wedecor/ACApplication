import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  orchestrationApi,
  type WorkflowInstanceStatus,
} from '@/lib/api/orchestration';

export const orchestrationKeys = {
  all: ['orchestration'] as const,
  list: (filters: { status?: WorkflowInstanceStatus }) =>
    [...orchestrationKeys.all, 'list', filters] as const,
  timeline: (id: string) => [...orchestrationKeys.all, 'timeline', id] as const,
  analytics: () => [...orchestrationKeys.all, 'analytics'] as const,
};

export function useWorkflows(filters: { status?: WorkflowInstanceStatus } = {}) {
  return useQuery({
    queryKey: orchestrationKeys.list(filters),
    queryFn: () => orchestrationApi.listWorkflows(filters),
    refetchInterval: 20_000,
  });
}

export function useWorkflowTimeline(id: string | null) {
  return useQuery({
    queryKey: orchestrationKeys.timeline(id ?? ''),
    queryFn: () => orchestrationApi.timeline(id!),
    enabled: Boolean(id),
  });
}

export function useWorkflowAnalytics() {
  return useQuery({
    queryKey: orchestrationKeys.analytics(),
    queryFn: () => orchestrationApi.analytics(),
    refetchInterval: 30_000,
  });
}

export function usePauseWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => orchestrationApi.pause(id),
    onSuccess: () => {
      toast.success('Workflow paused');
      void qc.invalidateQueries({ queryKey: orchestrationKeys.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useResumeWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => orchestrationApi.resume(id),
    onSuccess: () => {
      toast.success('Workflow resumed');
      void qc.invalidateQueries({ queryKey: orchestrationKeys.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCancelWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => orchestrationApi.cancel(id),
    onSuccess: () => {
      toast.success('Workflow cancelled');
      void qc.invalidateQueries({ queryKey: orchestrationKeys.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
