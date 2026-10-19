import { api } from '@/lib/api-client';

import type {
  AmcPlan,
  AmcSubscription,
  BookingDetail,
  BookingSlot,
  BookingSummary,
  CouponValidation,
  CreateBookingInput,
  CustomerAddress,
  CustomerAppliance,
  CustomerApplianceInput,
  FaqItem,
  InvoiceDetail,
  InvoiceSummary,
  NotificationItem,
  PaymentIntent,
  PaymentMethod,
  ReferralSummary,
  SupportMessage,
  SupportTicketSummary,
  TechnicianLocation,
  UserDevice,
} from './types';

/**
 * Customer-facing API surface.
 *
 * Endpoints are grouped by domain to mirror the backend's module layout
 * (`bookings`, `invoices`, `amc`, `notifications`, etc.). Each function
 * returns the shape declared in {@link ./types}.
 *
 * Server-side these routes are RBAC-gated so the access token is mapped
 * to the calling user; the customer-app never sends an explicit
 * `customerId` because the backend infers it from the JWT.
 */
export const bookingsApi = {
  list: (status?: 'active' | 'completed' | 'cancelled') =>
    api.get<BookingSummary[]>('/v1/me/bookings', { query: { status } }),
  detail: (id: string) => api.get<BookingDetail>(`/v1/me/bookings/${id}`),
  create: (input: CreateBookingInput) => api.post<BookingSummary>('/v1/me/bookings', input),
  reschedule: (id: string, body: { scheduledAt: string; slotEnd?: string; reason?: string }) =>
    api.patch<BookingSummary>(`/v1/me/bookings/${id}/reschedule`, body),
  cancel: (id: string, body: { reason: string }) =>
    api.patch<BookingSummary>(`/v1/me/bookings/${id}/cancel`, body),
  addNote: (id: string, body: { note: string }) =>
    api.post<{ ok: true }>(`/v1/me/bookings/${id}/notes`, body),
  addPhotos: (id: string, body: { urls: string[] }) =>
    api.post<{ ok: true }>(`/v1/me/bookings/${id}/photos`, body),
  rate: (id: string, body: { value: number; npsScore?: number; comment?: string; photos?: string[] }) =>
    api.post<{ ok: true }>(`/v1/me/bookings/${id}/rating`, body),
  raiseComplaint: (id: string, body: { reason: string; description: string }) =>
    api.post<{ ticketId: string }>(`/v1/me/bookings/${id}/complaint`, body),
  liveLocation: (id: string) =>
    api.get<TechnicianLocation | null>(`/v1/me/bookings/${id}/technician/location`),
  estimate: (input: { applianceCategory: string; issueId?: string; city?: string; isEmergency?: boolean }) =>
    api.post<{ estimateMinor: number; visitMinutes: number; surgeMultiplier?: number }>(
      '/v1/me/bookings/estimate',
      input,
    ),
  slots: (input: { applianceCategory: string; city?: string; date: string }) =>
    api.get<{ date: string; slots: BookingSlot[] }>(
      '/v1/me/bookings/slots',
      { query: input },
    ),
};

export const invoicesApi = {
  list: () => api.get<InvoiceSummary[]>('/v1/me/invoices'),
  detail: (id: string) => api.get<InvoiceDetail>(`/v1/me/invoices/${id}`),
  pay: (id: string, body: { gateway: 'razorpay' | 'stripe'; methodId?: string }) =>
    api.post<PaymentIntent>(`/v1/me/invoices/${id}/pay`, body),
  confirm: (
    id: string,
    body: { gateway?: 'razorpay' | 'stripe'; returnUrl?: string; transactionId?: string },
  ) =>
    api.post<{ status: InvoiceSummary['status']; receiptUrl?: string }>(
      `/v1/me/invoices/${id}/pay/confirm`,
      body,
    ),
};

export const paymentsApi = {
  methods: () => api.get<PaymentMethod[]>('/v1/me/payment-methods'),
  setDefault: (id: string) => api.post<{ ok: true }>(`/v1/me/payment-methods/${id}/default`),
  remove: (id: string) => api.delete<{ ok: true }>(`/v1/me/payment-methods/${id}`),
  refunds: () => api.get<{ id: string; amountMinor: number; status: string; createdAt: string }[]>(
    '/v1/me/payment-methods/refunds',
  ),
};

export const amcApi = {
  plans: () => api.get<AmcPlan[]>('/v1/me/amc/plans'),
  mine: () => api.get<AmcSubscription[]>('/v1/me/amc'),
  /** `appliances`: ServiceCategory values and/or ids of registered appliances. */
  purchase: (body: { planId: string; appliances: string[]; addressId: string }) =>
    api.post<{ subscriptionId: string; invoiceId: string }>('/v1/me/amc/purchase', body),
  renew: (id: string) =>
    api.post<{ invoiceId: string }>(`/v1/me/amc/${id}/renew`),
};

export const notificationsApi = {
  list: () => api.get<NotificationItem[]>('/v1/me/notifications'),
  markRead: (id: string) => api.post<{ ok: true }>(`/v1/me/notifications/${id}/read`),
  markAllRead: () => api.post<{ ok: true }>('/v1/me/notifications/read-all'),
};

export const supportApi = {
  tickets: () => api.get<SupportTicketSummary[]>('/v1/me/support/tickets'),
  createTicket: (body: { subject: string; message: string; bookingId?: string }) =>
    api.post<SupportTicketSummary>('/v1/me/support/tickets', body),
  ticket: (id: string) => api.get<SupportTicketSummary>(`/v1/me/support/tickets/${id}`),
  messages: (id: string) =>
    api.get<SupportMessage[]>(`/v1/me/support/tickets/${id}/messages`),
  sendMessage: (id: string, body: string) =>
    api.post<{ ok: true; messageId: string }>(
      `/v1/me/support/tickets/${id}/messages`,
      { body },
    ),
  rate: (id: string, body: { rating: number; comment?: string }) =>
    api.post<{ ok: true }>(`/v1/me/support/tickets/${id}/csat`, body),
  faqs: () => api.get<FaqItem[]>('/v1/support/faqs'),
};

export const addressesApi = {
  list: () => api.get<CustomerAddress[]>('/v1/me/addresses'),
  create: (body: Omit<CustomerAddress, 'id' | 'isDefault'> & { setDefault?: boolean }) =>
    api.post<CustomerAddress>('/v1/me/addresses', body),
  update: (id: string, body: Partial<CustomerAddress>) =>
    api.patch<CustomerAddress>(`/v1/me/addresses/${id}`, body),
  remove: (id: string) => api.delete<{ ok: true }>(`/v1/me/addresses/${id}`),
  setDefault: (id: string) => api.post<{ ok: true }>(`/v1/me/addresses/${id}/default`),
};

export const profileApi = {
  me: () => api.get<{
    id: string;
    fullName?: string;
    phone?: string;
    email?: string;
    avatarUrl?: string | null;
    customerId?: string;
    devices: UserDevice[];
  }>('/v1/users/me'),
  update: (body: { fullName?: string; email?: string; avatarUrl?: string | null }) =>
    api.patch<{ ok: true }>('/v1/users/me', body),
  revokeDevice: (deviceId: string) => api.delete<{ ok: true }>(`/v1/me/devices/${deviceId}`),
  logoutAll: () => api.post<{ ok: true }>('/v1/auth/logout-all'),
};

export const uploadApi = {
  presign: (body: { filename: string; contentType: string; sizeBytes: number }) =>
    api.post<{ uploadUrl: string; publicUrl: string; headers?: Record<string, string> }>(
      '/v1/me/uploads/presign',
      body,
    ),
};

export const appliancesApi = {
  list: () => api.get<CustomerAppliance[]>('/v1/me/appliances'),
  detail: (id: string) => api.get<CustomerAppliance>(`/v1/me/appliances/${id}`),
  create: (body: CustomerApplianceInput) => api.post<CustomerAppliance>('/v1/me/appliances', body),
  update: (id: string, body: Partial<CustomerApplianceInput>) =>
    api.patch<CustomerAppliance>(`/v1/me/appliances/${id}`, body),
  remove: (id: string) => api.delete<{ ok: true }>(`/v1/me/appliances/${id}`),
};

/** Served by the growth module. */
export const referralsApi = {
  mine: () => api.get<ReferralSummary>('/v1/me/referrals'),
  apply: (code: string) => api.post<{ ok: true }>('/v1/me/referrals/apply', { code }),
};

/** Served by the growth module. */
export const couponsApi = {
  validate: (body: { code: string; category?: string; amountMinor?: number }) =>
    api.post<CouponValidation>('/v1/me/coupons/validate', body),
};
