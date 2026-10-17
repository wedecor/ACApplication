import type { ServiceCategory } from '@ac/types';

import { apiFetch, type PaginatedResponse } from './client';
import type { TechnicianStatus } from './tracking';

export type TechnicianAccountStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'DELETED';
export type CommissionType = 'FLAT' | 'PERCENTAGE' | 'PER_JOB';
export type PayoutCycle = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'ON_DEMAND';
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type WorkingHours = Partial<Record<Weekday, [string, string][]>>;

export interface TechnicianDocument {
  type: string;
  url: string;
  label?: string | null;
  expiresAt?: string | null;
  verified?: boolean;
}

export interface TechnicianListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  cityId?: string;
  status?: TechnicianStatus[];
  accountStatus?: Exclude<TechnicianAccountStatus, 'DELETED'>;
  skill?: ServiceCategory[];
  sort?: string;
}

export interface TechnicianListItem {
  id: string;
  userId: string;
  employeeCode: string;
  fullName: string;
  phone: string;
  skills: ServiceCategory[];
  rating: number;
  totalJobs: number;
  acceptanceRate: number;
  completionRate: number;
  dailyCapacity: number;
  status: TechnicianStatus;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
  city: { id: string; name: string; state: string };
  user: { id: string; email: string | null; status: TechnicianAccountStatus; lastLoginAt: string | null };
  openBookings: number;
}

export interface TechnicianBookingSummary {
  id: string;
  code: string;
  status: string;
  category: ServiceCategory;
  serviceType: string | null;
  scheduledAt: string;
  scheduledTimeSlot: string | null;
  completedAt: string | null;
  finalAmountMinor: number | null;
  estimatedAmountMinor: number;
  currency: string;
  customer: { id: string; fullName: string };
  city: { id: string; name: string };
}

export interface TechnicianRatingEntry {
  id: string;
  bookingId: string;
  value: number;
  npsScore: number | null;
  comment: string | null;
  createdAt: string;
  booking: { id: string; code: string; category: ServiceCategory };
  customer: { id: string; fullName: string };
}

export interface TechnicianDetail extends Omit<TechnicianListItem, 'openBookings' | 'user'> {
  workingHours: WorkingHours;
  documents: TechnicianDocument[];
  onlineSince: string | null;
  lastLocationAt: string | null;
  lastBatteryPct: number | null;
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
    status: TechnicianAccountStatus;
    lastLoginAt: string | null;
    createdAt: string;
    createdBy: string | null;
    updatedBy: string | null;
  };
  hasCustomCommissionRule: boolean;
  stats: {
    totalJobs: number;
    completedJobs: number;
    cancelledJobs: number;
    noShowJobs: number;
    openBookings: number;
    bookingsByStatus: Record<string, number>;
    rating: number;
    ratingCount: number;
    ratingDistribution: { value: number; count: number }[];
    acceptanceRate: number;
    completionRate: number;
  };
  recentBookings: TechnicianBookingSummary[];
  recentRatings: TechnicianRatingEntry[];
}

export interface TechnicianFormOptions {
  cities: { id: string; name: string; state: string }[];
  skills: ServiceCategory[];
  commissionTypes: CommissionType[];
  payoutCycles: PayoutCycle[];
}

export interface CreateTechnicianInput {
  firstName: string;
  lastName?: string;
  phone: string;
  email?: string;
  cityId: string;
  employeeCode?: string;
  skills: ServiceCategory[];
  dailyCapacity?: number;
  workingHours?: WorkingHours;
  documents?: TechnicianDocument[];
}

export type UpdateTechnicianInput = Partial<CreateTechnicianInput>;

export interface DeactivateTechnicianResult {
  id: string;
  accountStatus: TechnicianAccountStatus;
  openBookingsLeftAssigned: number;
  sessionsRevoked: number;
}

export interface CommissionRule {
  id: string;
  technicianId: string;
  type: CommissionType;
  valueMinor: number;
  bonusMinor: number;
  penaltyPerLateMinuteMinor: number;
  minPayoutMinor: number;
  payoutCycle: PayoutCycle;
  cycleClosesOn: number;
  updatedAt: string;
}

export interface CommissionRuleResponse {
  technicianId: string;
  isDefault: boolean;
  rule: CommissionRule | null;
}

export type UpsertCommissionRuleInput = Omit<CommissionRule, 'id' | 'technicianId' | 'updatedAt'>;

export const techniciansApi = {
  formOptions: () => apiFetch<TechnicianFormOptions>('/technicians/form-options'),

  list: (query: TechnicianListQuery = {}) =>
    apiFetch<PaginatedResponse<TechnicianListItem>>('/technicians', {
      query: query as Record<string, unknown>,
    }),

  get: (id: string) => apiFetch<TechnicianDetail>(`/technicians/${id}`),

  create: (input: CreateTechnicianInput) =>
    apiFetch<TechnicianDetail>('/technicians', { method: 'POST', body: input }),

  update: (id: string, input: UpdateTechnicianInput) =>
    apiFetch<TechnicianDetail>(`/technicians/${id}`, { method: 'PATCH', body: input }),

  deactivate: (id: string, body: { reason?: string; force?: boolean }) =>
    apiFetch<DeactivateTechnicianResult>(`/technicians/${id}/deactivate`, { method: 'POST', body }),

  reactivate: (id: string) =>
    apiFetch<{ id: string; accountStatus: TechnicianAccountStatus }>(`/technicians/${id}/reactivate`, {
      method: 'POST',
      body: {},
    }),

  bookings: (id: string, query: { page?: number; pageSize?: number } = {}) =>
    apiFetch<PaginatedResponse<TechnicianBookingSummary>>(`/technicians/${id}/bookings`, { query }),

  ratings: (id: string, query: { page?: number; pageSize?: number } = {}) =>
    apiFetch<PaginatedResponse<TechnicianRatingEntry>>(`/technicians/${id}/ratings`, { query }),

  commissionRule: (id: string) => apiFetch<CommissionRuleResponse>(`/technicians/${id}/commission-rule`),

  upsertCommissionRule: (id: string, input: UpsertCommissionRuleInput) =>
    apiFetch<CommissionRuleResponse>(`/technicians/${id}/commission-rule`, { method: 'PUT', body: input }),

  deleteCommissionRule: (id: string) =>
    apiFetch<CommissionRuleResponse>(`/technicians/${id}/commission-rule`, { method: 'DELETE' }),
};
