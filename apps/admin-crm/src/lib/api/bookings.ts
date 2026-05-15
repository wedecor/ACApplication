import type {
  Booking,
  BookingActivityEntry,
  BookingAttachmentEntry,
  BookingAttachmentKind,
  BookingId,
  BookingNoteEntry,
  BookingPaymentStatus,
  BookingPriority,
  BookingStatus,
  ServiceCategory,
} from '@ac/types';

import { apiFetch, type PaginatedResponse } from './client';

export interface BookingAddressInput {
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
}

export interface CreateBookingInput {
  leadId?: string;
  customerId: string;
  cityId: string;
  category: ServiceCategory;
  serviceType?: string;
  applianceBrand?: string;
  applianceType?: string;
  issueDescription?: string;
  scheduledAt: string;
  scheduledTimeSlot?: string;
  priority?: BookingPriority;
  estimatedAmountMinor?: number;
  address: BookingAddressInput;
  addressId?: string;
  geoLatitude?: number;
  geoLongitude?: number;
  notes?: string;
}

export type UpdateBookingInput = Partial<Omit<CreateBookingInput, 'customerId' | 'cityId' | 'leadId'>>;

export interface BookingListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: BookingStatus[];
  paymentStatus?: BookingPaymentStatus[];
  priority?: BookingPriority[];
  category?: ServiceCategory[];
  cityId?: string;
  technicianId?: string;
  customerId?: string;
  scheduledFrom?: string;
  scheduledTo?: string;
  sort?: string;
}

export type BookingListItem = Booking & {
  customer: { id: string; fullName: string; phone: string; email: string | null };
  technician: {
    id: string;
    fullName: string;
    phone: string;
    rating: number;
    status: string;
  } | null;
  city: { id: string; name: string; state: string };
  address: {
    id: string;
    line1: string;
    line2: string | null;
    landmark: string | null;
    city: string;
    state: string;
    pincode: string;
    latitude: number | null;
    longitude: number | null;
  };
  lead: { id: string; code: string } | null;
  _count: { activities: number; bookingNotes: number; attachments: number };
};

export const bookingsApi = {
  list: (query: BookingListQuery = {}) =>
    apiFetch<PaginatedResponse<BookingListItem>>('/bookings', {
      query: query as Record<string, unknown>,
    }),

  get: (id: BookingId | string) => apiFetch<BookingListItem>(`/bookings/${id}`),

  create: (input: CreateBookingInput) =>
    apiFetch<BookingListItem>('/bookings', { method: 'POST', body: input }),

  createFromLead: (leadId: string, input: CreateBookingInput) =>
    apiFetch<BookingListItem>(`/bookings/from-lead/${leadId}`, {
      method: 'POST',
      body: { booking: input },
    }),

  update: (id: BookingId | string, input: UpdateBookingInput) =>
    apiFetch<Booking>(`/bookings/${id}`, { method: 'PATCH', body: input }),

  assignTechnician: (
    id: BookingId | string,
    payload: { technicianId?: string; autoPick?: boolean; reason?: string },
  ) =>
    apiFetch<Booking>(`/bookings/${id}/assign-technician`, {
      method: 'POST',
      body: payload,
    }),

  changeStatus: (
    id: BookingId | string,
    payload: { status: BookingStatus; reason?: string; finalAmountMinor?: number },
  ) =>
    apiFetch<Booking>(`/bookings/${id}/status`, { method: 'POST', body: payload }),

  reschedule: (
    id: BookingId | string,
    payload: { scheduledAt: string; scheduledTimeSlot?: string; reason?: string },
  ) =>
    apiFetch<Booking>(`/bookings/${id}/reschedule`, { method: 'POST', body: payload }),

  sendOtp: (id: BookingId | string) =>
    apiFetch<{ ok?: true; devCode?: string }>(`/bookings/${id}/otp/send`, { method: 'POST' }),

  verifyOtp: (id: BookingId | string, code: string) =>
    apiFetch<Booking>(`/bookings/${id}/verify-otp`, {
      method: 'POST',
      body: { code },
    }),

  addNote: (id: BookingId | string, payload: { body: string; isInternal?: boolean }) =>
    apiFetch<BookingNoteEntry>(`/bookings/${id}/notes`, { method: 'POST', body: payload }),

  listNotes: (id: BookingId | string) =>
    apiFetch<BookingNoteEntry[]>(`/bookings/${id}/notes`),

  addAttachment: (
    id: BookingId | string,
    payload: {
      kind: BookingAttachmentKind;
      url: string;
      storageKey: string;
      mimeType?: string;
      sizeBytes?: number;
      caption?: string;
    },
  ) =>
    apiFetch<BookingAttachmentEntry>(`/bookings/${id}/attachments`, {
      method: 'POST',
      body: payload,
    }),

  listAttachments: (id: BookingId | string) =>
    apiFetch<BookingAttachmentEntry[]>(`/bookings/${id}/attachments`),

  setSignature: (id: BookingId | string, url: string) =>
    apiFetch<Booking>(`/bookings/${id}/signature`, { method: 'POST', body: { url } }),

  listActivities: (id: BookingId | string) =>
    apiFetch<BookingActivityEntry[]>(`/bookings/${id}/activities`),
};
