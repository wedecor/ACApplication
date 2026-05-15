'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  type CreateLeadInput,
  type LeadListQuery,
  leadsApi,
  type UpdateLeadInput,
} from '@/lib/api/leads';
import { queryKeys } from '@/lib/api/query-keys';
import type { LeadStatus } from '@ac/types';

export function useLeads(query: LeadListQuery) {
  return useQuery({
    queryKey: queryKeys.leads.list(query as Record<string, unknown>),
    queryFn: () => leadsApi.list(query),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.leads.detail(id) : ['leads', 'detail', 'noop'],
    queryFn: () => leadsApi.get(id!),
    enabled: !!id,
  });
}

export function useLeadNotes(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.leads.notes(id) : ['leads', 'noop', 'notes'],
    queryFn: () => leadsApi.listNotes(id!),
    enabled: !!id,
  });
}

export function useLeadActivities(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.leads.activities(id) : ['leads', 'noop', 'activities'],
    queryFn: () => leadsApi.listActivities(id!),
    enabled: !!id,
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLeadInput) => leadsApi.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.leads.all });
    },
  });
}

export function useUpdateLead(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateLeadInput) => leadsApi.update(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.leads.detail(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.leads.all });
    },
  });
}

export function useAssignLead(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assigneeUserId: string) => leadsApi.assign(id, assigneeUserId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.leads.detail(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.leads.activities(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.leads.all });
    },
  });
}

export function useChangeLeadStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ status, reason }: { status: LeadStatus; reason?: string }) =>
      leadsApi.changeStatus(id, status, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.leads.detail(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.leads.activities(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.leads.all });
    },
  });
}

export function useAddLeadNote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => leadsApi.addNote(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.leads.notes(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.leads.activities(id) });
    },
  });
}
