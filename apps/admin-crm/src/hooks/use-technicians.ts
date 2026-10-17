'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type CreateTechnicianInput,
  type TechnicianListQuery,
  techniciansApi,
  type UpdateTechnicianInput,
  type UpsertCommissionRuleInput,
} from '@/lib/api/technicians';

/** Query keys for the technician roster (kept local to avoid churn in the shared factory). */
export const technicianKeys = {
  all: ['technicians'] as const,
  formOptions: ['technicians', 'form-options'] as const,
  list: (params: Record<string, unknown>) => ['technicians', 'list', params] as const,
  detail: (id: string) => ['technicians', 'detail', id] as const,
  bookings: (id: string, page: number) => ['technicians', id, 'bookings', page] as const,
  ratings: (id: string, page: number) => ['technicians', id, 'ratings', page] as const,
  commission: (id: string) => ['technicians', id, 'commission-rule'] as const,
};

export function useTechnicianFormOptions() {
  return useQuery({
    queryKey: technicianKeys.formOptions,
    queryFn: () => techniciansApi.formOptions(),
    staleTime: 5 * 60_000,
  });
}

export function useTechnicians(query: TechnicianListQuery) {
  return useQuery({
    queryKey: technicianKeys.list(query as Record<string, unknown>),
    queryFn: () => techniciansApi.list(query),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useTechnician(id: string | undefined) {
  return useQuery({
    queryKey: id ? technicianKeys.detail(id) : ['technicians', 'detail', 'noop'],
    queryFn: () => techniciansApi.get(id!),
    enabled: !!id,
  });
}

export function useTechnicianBookings(id: string | undefined, page: number) {
  return useQuery({
    queryKey: id ? technicianKeys.bookings(id, page) : ['technicians', 'noop', 'bookings'],
    queryFn: () => techniciansApi.bookings(id!, { page, pageSize: 10 }),
    enabled: !!id,
    placeholderData: keepPreviousData,
  });
}

export function useTechnicianCommissionRule(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: id ? technicianKeys.commission(id) : ['technicians', 'noop', 'commission'],
    queryFn: () => techniciansApi.commissionRule(id!),
    enabled: !!id && enabled,
    retry: false,
  });
}

function useInvalidateTechnicians() {
  const qc = useQueryClient();
  return (id?: string) => {
    void qc.invalidateQueries({ queryKey: technicianKeys.all });
    // The live availability view reads the same technicians.
    void qc.invalidateQueries({ queryKey: ['tracking'] });
    if (id) void qc.invalidateQueries({ queryKey: technicianKeys.detail(id) });
  };
}

export function useCreateTechnician() {
  const invalidate = useInvalidateTechnicians();
  return useMutation({
    mutationFn: (input: CreateTechnicianInput) => techniciansApi.create(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateTechnician(id: string) {
  const invalidate = useInvalidateTechnicians();
  return useMutation({
    mutationFn: (input: UpdateTechnicianInput) => techniciansApi.update(id, input),
    onSuccess: () => invalidate(id),
  });
}

export function useDeactivateTechnician() {
  const invalidate = useInvalidateTechnicians();
  return useMutation({
    mutationFn: ({ id, reason, force }: { id: string; reason?: string; force?: boolean }) =>
      techniciansApi.deactivate(id, { reason, force }),
    onSuccess: (_res, vars) => invalidate(vars.id),
  });
}

export function useReactivateTechnician() {
  const invalidate = useInvalidateTechnicians();
  return useMutation({
    mutationFn: (id: string) => techniciansApi.reactivate(id),
    onSuccess: (_res, id) => invalidate(id),
  });
}

export function useUpsertCommissionRule(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertCommissionRuleInput) => techniciansApi.upsertCommissionRule(id, input),
    onSuccess: (data) => {
      qc.setQueryData(technicianKeys.commission(id), data);
      void qc.invalidateQueries({ queryKey: technicianKeys.detail(id) });
    },
  });
}

export function useDeleteCommissionRule(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => techniciansApi.deleteCommissionRule(id),
    onSuccess: (data) => {
      qc.setQueryData(technicianKeys.commission(id), data);
      void qc.invalidateQueries({ queryKey: technicianKeys.detail(id) });
    },
  });
}
