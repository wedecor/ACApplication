import { apiFetch } from './client';

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
  status: QuotationStatus;
  expiresAt: string;
  sentAt: string | null;
  viewedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  convertedAt: string | null;
  convertedInvoiceId: string | null;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  currency: string;
  notes: string | null;
  terms: string | null;
  viewToken: string;
  customer?: { id: string; fullName: string };
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPriceMinor: number;
    taxRateBps: number;
    subtotalMinor: number;
    totalMinor: number;
  }>;
}

export interface CreateQuotationInput {
  customerId: string;
  bookingId?: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPriceMinor: number;
    discountMinor?: number;
    taxRateBps?: number;
    hsnSacCode?: string;
  }>;
  expiresAt?: string;
  gstEnabled?: boolean;
  notes?: string;
  terms?: string;
}

export interface ListQuotationsParams {
  page?: number;
  pageSize?: number;
  status?: QuotationStatus;
  customerId?: string;
  q?: string;
}

export const quotationsApi = {
  list: (params: ListQuotationsParams) =>
    apiFetch<{
      items: Quotation[];
      meta: { page: number; pageSize: number; total: number; totalPages: number };
    }>('/quotations', { query: params as Record<string, unknown> }),
  detail: (id: string) => apiFetch<Quotation>(`/quotations/${id}`),
  create: (body: CreateQuotationInput) =>
    apiFetch<Quotation>('/quotations', { method: 'POST', body }),
  send: (id: string) => apiFetch<Quotation>(`/quotations/${id}/send`, { method: 'POST' }),
  convert: (id: string) =>
    apiFetch<{ id: string; number: string }>(`/quotations/${id}/convert`, { method: 'POST' }),
  downloadPdfUrl: (id: string) => `/quotations/${id}/download-pdf`,
};
