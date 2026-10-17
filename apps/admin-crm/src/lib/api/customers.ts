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

// ---------------------------------------------------------------------------
// CRM extensions: create / update / duplicates / merge.
// ---------------------------------------------------------------------------

/** Extra fields returned by the customers API once CRM extensions are enabled. */
export interface CustomerCrmFields {
  tags?: string[];
  customFields?: Record<string, unknown>;
  accountId?: string | null;
  account?: { id: string; name: string } | null;
  preferredLanguage?: string;
  loyaltyPoints?: number;
  mergedIntoId?: string | null;
  preferences?: Record<string, unknown>;
}

export type CustomerDetail = CustomerListItem & CustomerCrmFields;

export interface CustomerFilterQuery extends CustomerListQuery {
  tag?: string;
  accountId?: string;
}

export interface CustomerInput {
  fullName: string;
  phone: string;
  email?: string;
  cityId?: string;
  accountId?: string | null;
  tags?: string[];
  customFields?: Record<string, unknown>;
  preferredLanguage?: string;
}

export type DuplicateReason = 'phone' | 'email' | 'name_pincode' | 'name';

export interface DuplicateMatch {
  customer: CustomerDetail;
  reasons: DuplicateReason[];
  score: number;
}

export interface DuplicateQuery {
  phone?: string;
  email?: string;
  fullName?: string;
  pincode?: string;
  excludeId?: string;
}

export const customersCrmApi = {
  list: (query: CustomerFilterQuery = {}) =>
    apiFetch<PaginatedResponse<CustomerDetail>>('/customers', {
      query: query as Record<string, unknown>,
    }),
  get: (id: string) => apiFetch<CustomerDetail>(`/customers/${id}`),
  create: (input: CustomerInput) =>
    apiFetch<CustomerDetail>('/customers', { method: 'POST', body: input }),
  update: (id: string, input: Partial<CustomerInput>) =>
    apiFetch<CustomerDetail>(`/customers/${id}`, { method: 'PATCH', body: input }),
  findDuplicates: (query: DuplicateQuery) =>
    apiFetch<{ items: DuplicateMatch[] }>('/customers/duplicates', {
      query: query as Record<string, unknown>,
    }),
  duplicatesOf: (id: string) =>
    apiFetch<{ items: DuplicateMatch[] }>(`/customers/${id}/duplicates`),
  merge: (id: string, intoCustomerId: string) =>
    apiFetch<CustomerDetail>(`/customers/${id}/merge`, {
      method: 'POST',
      body: { intoCustomerId },
    }),
};
