import { api } from './api';
import { getTechnicianId } from './auth';

export type TechnicianStatus =
  | 'OFFLINE'
  | 'ONLINE'
  | 'AVAILABLE'
  | 'BUSY'
  | 'ON_BREAK'
  | 'EN_ROUTE'
  | 'WORKING'
  | 'UNREACHABLE';

export interface JobSummary {
  id: string;
  code: string;
  status: string;
  scheduledAt: string;
  scheduledTimeSlot: string | null;
  category: string;
  serviceType: string | null;
  applianceBrand: string | null;
  applianceType: string | null;
  issueDescription: string | null;
  addressSnapshot: Record<string, string>;
  geoLatitude: number | null;
  geoLongitude: number | null;
  estimatedAmountMinor: number;
  customer: { id: string; fullName: string; phone: string };
}

export const technicianApi = {
  /** Self-service status change (from the field-app toggle). */
  setStatus: (technicianId: string, status: TechnicianStatus, reason?: string) =>
    api(`/technicians/${technicianId}/status`, {
      method: 'POST',
      body: { status, reason },
    }),

  /** The tech's assigned-but-not-completed bookings. */
  myJobs: async (): Promise<JobSummary[]> => {
    const technicianId = await getTechnicianId();
    if (!technicianId) return [];
    const res = await api<{ items: JobSummary[] }>(`/bookings`, {
      query: { technicianId, pageSize: 30, sortBy: 'scheduledAt:asc' },
    });
    return res.items;
  },

  acceptJob: (bookingId: string) =>
    api(`/bookings/${bookingId}/status`, {
      method: 'POST',
      body: { status: 'TECHNICIAN_EN_ROUTE' },
    }),

  /** Mark "I have arrived" — server stamps `arrivedAt` + emits TechnicianArrived. */
  markArrived: (bookingId: string) =>
    api(`/bookings/${bookingId}/status`, {
      method: 'POST',
      body: { status: 'TECHNICIAN_EN_ROUTE', reason: 'Reached customer' },
    }),

  startService: (bookingId: string) =>
    api(`/bookings/${bookingId}/status`, {
      method: 'POST',
      body: { status: 'IN_PROGRESS' },
    }),

  waitForParts: (bookingId: string, note?: string) =>
    api(`/bookings/${bookingId}/status`, {
      method: 'POST',
      body: { status: 'WAITING_PARTS', reason: note ?? 'Awaiting spare parts' },
    }),

  completeJob: (bookingId: string) =>
    api(`/bookings/${bookingId}/status`, {
      method: 'POST',
      body: { status: 'COMPLETED' },
    }),

  rejectJob: (bookingId: string, reason: string) =>
    api(`/dispatch/reassign`, {
      method: 'POST',
      body: { bookingId, autoPick: true, reason: `Tech rejected: ${reason}` },
    }),

  sendOtp: (bookingId: string) =>
    api(`/bookings/${bookingId}/otp/send`, { method: 'POST', body: {} }),

  verifyOtp: (bookingId: string, code: string) =>
    api(`/bookings/${bookingId}/verify-otp`, { method: 'POST', body: { code } }),

  addNote: (bookingId: string, body: string) =>
    api(`/bookings/${bookingId}/notes`, { method: 'POST', body: { body } }),
};
