import { apiFetch } from './client';

export type TechnicianStatus =
  | 'OFFLINE'
  | 'ONLINE'
  | 'AVAILABLE'
  | 'BUSY'
  | 'ON_BREAK'
  | 'EN_ROUTE'
  | 'WORKING'
  | 'UNREACHABLE';

export interface LiveTechnicianSnapshot {
  technicianId: string;
  fullName: string;
  cityId: string;
  status: TechnicianStatus;
  rating: number;
  activeJobs: number;
  latitude: number | null;
  longitude: number | null;
  heading: number | null;
  speedMps: number | null;
  batteryPct: number | null;
  lastSeenAt: string | null;
  lastLocationAt: string | null;
  activeBookingId: string | null;
  activeBookingCode: string | null;
}

export interface AvailabilityOverview {
  buckets: {
    available: number;
    engaged: number;
    onBreak: number;
    offline: number;
    unreachable: number;
  };
  technicians: Array<{
    id: string;
    fullName: string;
    cityId: string;
    status: TechnicianStatus;
    rating: number;
    acceptanceRate: number;
    completionRate: number;
    dailyCapacity: number;
    lastSeenAt: string | null;
    onlineSince: string | null;
    lastLocationAt: string | null;
    _count: { bookings: number };
  }>;
}

export interface LocationHistoryPoint {
  id: string;
  technicianId: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  speedMps: number | null;
  accuracyM: number | null;
  recordedAt: string;
}

export const trackingApi = {
  liveMap: (params: { cityId?: string; status?: TechnicianStatus[] } = {}) =>
    apiFetch<LiveTechnicianSnapshot[]>('/technicians/live-map', {
      query: {
        ...(params.cityId ? { cityId: params.cityId } : {}),
        ...(params.status?.length ? { status: params.status.join(',') } : {}),
      },
    }),

  availability: (cityId?: string | null) =>
    apiFetch<AvailabilityOverview>('/technicians/availability', {
      query: cityId ? { cityId } : undefined,
    }),

  history: (technicianId: string, sinceMinutes = 120) =>
    apiFetch<LocationHistoryPoint[]>(`/technicians/${technicianId}/history`, {
      query: { sinceMinutes },
    }),

  setStatus: (technicianId: string, status: TechnicianStatus, reason?: string) =>
    apiFetch<unknown>(`/technicians/${technicianId}/status`, {
      method: 'POST',
      body: { status, reason },
    }),
};
