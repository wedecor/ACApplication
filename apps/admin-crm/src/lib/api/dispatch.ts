import { apiFetch } from './client';

export interface DispatchRecommendation {
  technicianId: string;
  fullName: string;
  status: string;
  rating: number;
  activeJobs: number;
  distanceKm: number | null;
  etaMin: number | null;
  trafficEtaMin: number | null;
  score: number;
  breakdown: {
    base: number;
    eta: number;
    responseTime: number;
    repeatCustomer: number;
    priorityBoost: number;
  };
}

export interface DispatchAlert {
  id: string;
  kind:
    | 'TECHNICIAN_DELAYED'
    | 'TECHNICIAN_UNREACHABLE'
    | 'BOOKING_OVERDUE'
    | 'LOW_AVAILABILITY'
    | 'NO_CANDIDATES';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  cityId: string | null;
  resourceType: string | null;
  resourceId: string | null;
  technicianId: string | null;
  technician?: { id: string; fullName: string } | null;
  acknowledgedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface UnassignedBooking {
  id: string;
  code: string;
  status: string;
  priority: 'STANDARD' | 'PRIORITY' | 'EMERGENCY';
  category: string;
  scheduledAt: string;
  cityId: string;
  geoLatitude: number | null;
  geoLongitude: number | null;
  customer: { id: string; fullName: string; phone: string };
  city: { id: string; name: string };
}

export interface DispatchDecisionRow {
  id: string;
  bookingId: string;
  technicianId: string;
  decision: string;
  score: number | null;
  distanceKm: number | null;
  etaMin: number | null;
  reason: string | null;
  createdAt: string;
  technician?: { id: string; fullName: string };
}

export const dispatchApi = {
  unassigned: (cityId?: string | null) =>
    apiFetch<UnassignedBooking[]>('/dispatch/unassigned', {
      query: cityId ? { cityId } : undefined,
    }),

  recommendations: (bookingId: string) =>
    apiFetch<DispatchRecommendation[]>(`/dispatch/recommendations/${bookingId}`),

  autoAssign: (bookingId: string) =>
    apiFetch<{ booking: string; assignment: DispatchDecisionRow; recommendations: DispatchRecommendation[] }>(
      `/dispatch/auto-assign/${bookingId}`,
      { method: 'POST', body: {} },
    ),

  manualAssign: (input: { bookingId: string; technicianId: string; reason?: string }) =>
    apiFetch<DispatchDecisionRow>('/dispatch/manual-assign', { method: 'POST', body: input }),

  reassign: (input: {
    bookingId: string;
    toTechnicianId?: string;
    autoPick?: boolean;
    reason?: string;
  }) => apiFetch<DispatchDecisionRow>('/dispatch/reassign', { method: 'POST', body: input }),

  alerts: (cityId?: string | null) =>
    apiFetch<DispatchAlert[]>('/dispatch/alerts', { query: cityId ? { cityId } : undefined }),

  acknowledgeAlert: (id: string, note?: string) =>
    apiFetch<DispatchAlert>(`/dispatch/alerts/${id}/acknowledge`, {
      method: 'POST',
      body: { note },
    }),

  recentDecisions: (cityId?: string | null) =>
    apiFetch<DispatchDecisionRow[]>('/dispatch/recent-decisions', {
      query: cityId ? { cityId } : undefined,
    }),
};
