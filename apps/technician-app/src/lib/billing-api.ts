/**
 * Quotation calls used by the on-site quote screen
 * (apps/api/src/modules/quotations — TECHNICIAN: quotation:view, quotation:create).
 *
 * Invoice / payment / quotation-send go through the technician-scoped
 * field-billing endpoints in `repair-api.ts` (`fieldBillingApi`) — the
 * generic /invoices and /payments routes aren't tenant-scoped per technician.
 */
import Constants from 'expo-constants';

import { api, API_URL } from './api';
import type { QuotationLineItemInput } from './quote-math';

export type QuotationStatus =
  | 'DRAFT'
  | 'SENT'
  | 'VIEWED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CONVERTED';

export interface Quotation {
  id: string;
  number: string;
  customerId: string;
  bookingId: string | null;
  status: QuotationStatus;
  expiresAt: string;
  sentAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  currency: string;
  notes: string | null;
  viewToken: string;
  convertedInvoiceId: string | null;
  createdAt: string;
  lineItems?: {
    description: string;
    quantity: number;
    unitPriceMinor: number;
    taxRateBps: number;
    totalMinor: number;
  }[];
}

export interface CreateQuotationInput {
  customerId: string;
  bookingId?: string;
  lineItems: QuotationLineItemInput[];
  gstEnabled?: boolean;
  expiresAt?: string;
  notes?: string;
}

const CUSTOMER_PORTAL_URL =
  (Constants.expoConfig?.extra as { customerPortalUrl?: string } | undefined)?.customerPortalUrl ??
  process.env.EXPO_PUBLIC_CUSTOMER_PORTAL_URL ??
  null;

/**
 * Link the customer opens to approve / reject. Uses the customer portal
 * when configured, otherwise the API's public quotation endpoint.
 */
export function quotationApprovalUrl(q: Pick<Quotation, 'viewToken'>): string {
  return CUSTOMER_PORTAL_URL
    ? `${CUSTOMER_PORTAL_URL.replace(/\/$/, '')}/quotations/${q.viewToken}`
    : `${API_URL}/api/v1/quotations/public/${q.viewToken}`;
}

export const quotationsApi = {
  create: (body: CreateQuotationInput) => api<Quotation>('/quotations', { method: 'POST', body }),
  get: (id: string) => api<Quotation>(`/quotations/${id}`),
  /** Public endpoint — used when the customer approves on the technician's device. */
  approveOnSite: (viewToken: string) =>
    api<Quotation>(`/quotations/public/${viewToken}/approve`, { method: 'POST', body: {} }),
  rejectOnSite: (viewToken: string, reason?: string) =>
    api<Quotation>(`/quotations/public/${viewToken}/reject`, { method: 'POST', body: { reason } }),
};
