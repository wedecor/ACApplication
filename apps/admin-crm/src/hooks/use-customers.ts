'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type CustomerFilterQuery,
  type CustomerInput,
  type CustomerListQuery,
  customersApi,
  customersCrmApi,
  type DuplicateQuery,
} from '@/lib/api/customers';
import { queryKeys } from '@/lib/api/query-keys';

export function useCustomers(query: CustomerListQuery) {
  return useQuery({
    queryKey: queryKeys.customers.list(query as Record<string, unknown>),
    queryFn: () => customersApi.list(query),
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.customers.detail(id) : ['customers', 'detail', 'noop'],
    queryFn: () => customersApi.get(id!),
    enabled: Boolean(id),
  });
}

// ---------------------------------------------------------------------------
// CRM extensions (create / update / duplicates / merge).
// ---------------------------------------------------------------------------

export function useCustomersFiltered(query: CustomerFilterQuery) {
  return useQuery({
    queryKey: queryKeys.customers.list(query as Record<string, unknown>),
    queryFn: () => customersCrmApi.list(query),
  });
}

export function useCustomerDetail(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.customers.detail(id) : ['customers', 'detail', 'noop'],
    queryFn: () => customersCrmApi.get(id!),
    enabled: Boolean(id),
  });
}

export function useSaveCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: CustomerInput }) =>
      id ? customersCrmApi.update(id, input) : customersCrmApi.create(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.customers.all }),
  });
}

export function useCustomerDuplicates(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.customers.duplicates(id ?? 'none'),
    queryFn: () => customersCrmApi.duplicatesOf(id!),
    enabled: Boolean(id),
  });
}

export function useDuplicateCheck(query: DuplicateQuery, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.customers.duplicateCheck(query as Record<string, unknown>),
    queryFn: () => customersCrmApi.findDuplicates(query),
    enabled,
    staleTime: 30_000,
  });
}

export function useMergeCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, intoCustomerId }: { id: string; intoCustomerId: string }) =>
      customersCrmApi.merge(id, intoCustomerId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.customers.all }),
  });
}
