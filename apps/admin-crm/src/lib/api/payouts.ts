import { apiFetch } from './client';

export type PayoutStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED';

export interface TechnicianPayout {
  id: string;
  technicianId: string;
  code: string;
  periodStart: string;
  periodEnd: string;
  jobsCount: number;
  grossMinor: number;
  bonusMinor: number;
  penaltyMinor: number;
  adjustmentMinor: number;
  netMinor: number;
  currency: string;
  status: PayoutStatus;
  paymentRef: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  failureReason: string | null;
  notes: string | null;
  createdAt: string;
  technician?: { id: string; user: { firstName: string; lastName: string } };
}

export interface CommissionRow {
  id: string;
  bookingId: string;
  baseMinor: number;
  bonusMinor: number;
  penaltyMinor: number;
  adjustmentMinor: number;
  netMinor: number;
  status: 'ACCRUED' | 'ADJUSTED' | 'PAID' | 'REVERSED';
  notes: string | null;
  createdAt: string;
  booking?: { id: string; finalAmountMinor: number | null };
}

export const payoutsApi = {
  list: (params: { status?: PayoutStatus; technicianId?: string }) =>
    apiFetch<TechnicianPayout[]>('/payouts', { query: params as Record<string, unknown> }),
  detail: (id: string) =>
    apiFetch<TechnicianPayout & { commissions: CommissionRow[] }>(`/payouts/${id}`),
  pending: (technicianId: string) =>
    apiFetch<{ pendingNetMinor: number; pendingJobs: number }>(`/payouts/pending/${technicianId}`),
  create: (body: { technicianId: string; periodStart?: string; periodEnd?: string }) =>
    apiFetch<TechnicianPayout>('/payouts', { method: 'POST', body }),
  approve: (id: string, notes?: string) =>
    apiFetch<TechnicianPayout>(`/payouts/${id}/approve`, { method: 'POST', body: { notes } }),
  markPaid: (id: string, body: { paymentRef?: string; notes?: string }) =>
    apiFetch<TechnicianPayout>(`/payouts/${id}/mark-paid`, { method: 'POST', body }),
  fail: (id: string, reason: string) =>
    apiFetch<TechnicianPayout>(`/payouts/${id}/fail`, { method: 'POST', body: { reason } }),
};
