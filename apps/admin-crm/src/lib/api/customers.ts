import type { Customer, CustomerId } from '@ac/types';

import { apiFetch, type PaginatedResponse } from './client';

export interface CustomerListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  cityId?: string;
  sort?: string;
}

export type CustomerListItem = Customer & {
  city: { id: string; name: string; state: string } | null;
  _count: { bookings: number; invoices: number };
};

export const customersApi = {
  list: (query: CustomerListQuery = {}) =>
    apiFetch<PaginatedResponse<CustomerListItem>>('/customers', {
      query: query as Record<string, unknown>,
    }),

  get: (id: CustomerId | string) => apiFetch<CustomerListItem>(`/customers/${id}`),
};
