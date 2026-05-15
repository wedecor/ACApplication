'use client';

import { useQuery } from '@tanstack/react-query';

import {
  customersApi,
  type CustomerListQuery,
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
