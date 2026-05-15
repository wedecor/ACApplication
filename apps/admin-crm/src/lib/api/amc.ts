import { apiFetch } from './client';

export type AMCPlanType = 'BASIC' | 'STANDARD' | 'PREMIUM' | 'CUSTOM';
export type AMCSubscriptionStatus =
  | 'ACTIVE'
  | 'PAUSED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'PENDING_PAYMENT';
export type AMCVisitStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'MISSED'
  | 'CANCELLED'
  | 'RESCHEDULED';

export interface AmcPlan {
  id: string;
  slug: string;
  name: string;
  type: AMCPlanType;
  description: string | null;
  durationMonths: number;
  includedVisits: number;
  emergencySupport: boolean;
  prioritySupport: boolean;
  discountBps: number;
  appliancesCovered: string[];
  priceMinor: number;
  renewalPriceMinor: number;
  currency: string;
  visitCadenceDays: number;
  isActive: boolean;
  features: unknown;
}

export interface AmcSubscription {
  id: string;
  number: string;
  customerId: string;
  planId: string;
  status: AMCSubscriptionStatus;
  startsAt: string;
  endsAt: string;
  cancelledAt: string | null;
  priceMinor: number;
  renewalPriceMinor: number;
  autoRenew: boolean;
  visitsScheduled: number;
  visitsCompleted: number;
  plan?: AmcPlan;
  customer?: { id: string; fullName: string; phone: string };
}

export interface AmcVisit {
  id: string;
  visitNumber: number;
  status: AMCVisitStatus;
  scheduledFor: string;
  completedAt: string | null;
  bookingId: string | null;
  isComplimentary: boolean;
  notes: string | null;
}

export const amcApi = {
  listPlans: () => apiFetch<AmcPlan[]>('/amc/plans'),
  createPlan: (body: Partial<AmcPlan> & Pick<AmcPlan, 'slug' | 'name' | 'type'>) =>
    apiFetch<AmcPlan>('/amc/plans', { method: 'POST', body }),
  updatePlan: (id: string, body: Partial<AmcPlan>) =>
    apiFetch<AmcPlan>(`/amc/plans/${id}`, { method: 'PATCH', body }),
  listSubscriptions: (params: { status?: AMCSubscriptionStatus; customerId?: string }) =>
    apiFetch<AmcSubscription[]>('/amc/subscriptions', { query: params as Record<string, unknown> }),
  getSubscription: (id: string) =>
    apiFetch<AmcSubscription & { visits: AmcVisit[] }>(`/amc/subscriptions/${id}`),
  subscribe: (body: { customerId: string; planId: string; autoRenew?: boolean }) =>
    apiFetch<{ subscription: AmcSubscription; invoice: { id: string; number: string } }>(
      '/amc/subscriptions',
      { method: 'POST', body },
    ),
  cancel: (id: string, reason?: string) =>
    apiFetch<AmcSubscription>(`/amc/subscriptions/${id}/cancel`, {
      method: 'POST',
      body: { reason },
    }),
  generateVisits: (id: string) =>
    apiFetch<unknown>(`/amc/subscriptions/${id}/generate-visits`, { method: 'POST' }),
  downloadContractUrl: (id: string) => `/amc/subscriptions/${id}/download-contract`,
};
