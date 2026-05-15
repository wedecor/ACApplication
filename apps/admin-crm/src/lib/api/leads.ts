import type {
  Lead,
  LeadActivityEntry,
  LeadId,
  LeadNoteEntry,
  LeadPriority,
  LeadSource,
  LeadStatus,
  ServiceCategory,
} from '@ac/types';

import { apiFetch, type PaginatedResponse } from './client';

export interface LeadListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: LeadStatus[];
  source?: LeadSource[];
  priority?: LeadPriority[];
  cityId?: string;
  assignedUserId?: string;
  createdFrom?: string;
  createdTo?: string;
  tags?: string[];
  sort?: string;
}

export interface CreateLeadInput {
  customerName: string;
  phone: string;
  whatsappNumber?: string;
  email?: string;
  source: LeadSource;
  applianceType?: ServiceCategory;
  applianceBrand?: string;
  issueDescription?: string;
  addressLine1?: string;
  addressLine2?: string;
  landmark?: string;
  cityId?: string;
  pincode?: string;
  geoLatitude?: number;
  geoLongitude?: number;
  priority?: LeadPriority;
  tags?: string[];
  externalRef?: string;
}

export type UpdateLeadInput = Partial<Omit<CreateLeadInput, 'source' | 'externalRef'>>;

/** Lead with relations as returned by the API. */
export type LeadListItem = Lead & {
  city: { id: string; name: string; state: string } | null;
  assignedUser: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    avatarUrl: string | null;
  } | null;
  _count: { notes: number; activities: number };
};

export const leadsApi = {
  list: (query: LeadListQuery = {}) =>
    apiFetch<PaginatedResponse<LeadListItem>>('/leads', {
      query: query as Record<string, unknown>,
    }),

  get: (id: LeadId | string) => apiFetch<LeadListItem>(`/leads/${id}`),

  create: (input: CreateLeadInput) =>
    apiFetch<Lead>('/leads', { method: 'POST', body: input }),

  update: (id: LeadId | string, input: UpdateLeadInput) =>
    apiFetch<Lead>(`/leads/${id}`, { method: 'PATCH', body: input }),

  assign: (id: LeadId | string, assigneeUserId: string) =>
    apiFetch<Lead>(`/leads/${id}/assign`, {
      method: 'POST',
      body: { assigneeUserId },
    }),

  changeStatus: (id: LeadId | string, status: LeadStatus, reason?: string) =>
    apiFetch<Lead>(`/leads/${id}/status`, {
      method: 'POST',
      body: { status, reason },
    }),

  addNote: (id: LeadId | string, body: string) =>
    apiFetch<LeadNoteEntry>(`/leads/${id}/notes`, { method: 'POST', body: { body } }),

  listNotes: (id: LeadId | string) =>
    apiFetch<LeadNoteEntry[]>(`/leads/${id}/notes`),

  listActivities: (id: LeadId | string) =>
    apiFetch<LeadActivityEntry[]>(`/leads/${id}/activities`),
};
