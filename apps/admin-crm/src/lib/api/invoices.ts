import { env } from '@/env';

import { getAccessToken } from './auth-token';
import { apiFetch } from './client';

export type InvoiceStatus =
  | 'DRAFT'
  | 'SENT'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'REFUNDED';

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  discountMinor: number;
  taxRateBps: number;
  hsnSacCode: string | null;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  cgstMinor: number;
  sgstMinor: number;
  igstMinor: number;
}

export interface Invoice {
  id: string;
  number: string;
  customerId: string;
  bookingId: string | null;
  amcSubscriptionId: string | null;
  status: InvoiceStatus;
  issueDate: string | null;
  dueDate: string | null;
  paidAt: string | null;
  sentAt: string | null;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  amountPaidMinor: number;
  amountRefundedMinor: number;
  dueAmountMinor: number;
  currency: string;
  gstEnabled: boolean;
  gstNumber: string | null;
  placeOfSupply: string | null;
  notes: string | null;
  terms: string | null;
  pdfUrl: string | null;
  createdAt: string;
  lineItems: InvoiceLineItem[];
  customer?: { id: string; fullName: string; phone: string; email: string | null };
  payments?: Array<{
    id: string;
    amountMinor: number;
    method: string;
    status: string;
    capturedAt: string | null;
  }>;
}

export interface CreateInvoiceInput {
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
  discountMinor?: number;
  gstEnabled?: boolean;
  gstNumber?: string;
  placeOfSupply?: string;
  notes?: string;
  terms?: string;
  dueDate?: string;
  currency?: string;
}

export interface ListInvoicesParams {
  page?: number;
  pageSize?: number;
  status?: InvoiceStatus;
  customerId?: string;
  bookingId?: string;
  q?: string;
  overdueOnly?: boolean;
}

export const invoicesApi = {
  list: (params: ListInvoicesParams) =>
    apiFetch<{
      items: Invoice[];
      meta: { page: number; pageSize: number; total: number; totalPages: number };
    }>('/invoices', { query: params as Record<string, unknown> }),
  detail: (id: string) => apiFetch<Invoice>(`/invoices/${id}`),
  create: (body: CreateInvoiceInput) =>
    apiFetch<Invoice>('/invoices', { method: 'POST', body }),
  update: (id: string, body: Partial<CreateInvoiceInput>) =>
    apiFetch<Invoice>(`/invoices/${id}`, { method: 'PATCH', body }),
  send: (id: string) => apiFetch<Invoice>(`/invoices/${id}/send`, { method: 'POST' }),
  cancel: (id: string, reason?: string) =>
    apiFetch<Invoice>(`/invoices/${id}/cancel`, { method: 'POST', body: { reason } }),
  recordPayment: (
    id: string,
    body: { amountMinor: number; method: string; gatewayRef?: string; notes?: string },
  ) => apiFetch<Invoice>(`/invoices/${id}/payments`, { method: 'POST', body }),
  refund: (id: string, body: { amountMinor: number; paymentId?: string; reason?: string }) =>
    apiFetch<{ invoice: Invoice; refund: unknown; creditNote: unknown | null }>(
      `/invoices/${id}/refund`,
      { method: 'POST', body },
    ),
  duplicate: (id: string) => apiFetch<Invoice>(`/invoices/${id}/duplicate`, { method: 'POST' }),
};

/**
 * Render the invoice PDF on the API (POST) and save it in the browser.
 * The endpoint streams application/pdf, so it can't go through apiFetch's JSON envelope.
 */
export async function downloadInvoicePdf(id: string, filename: string): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/v1/invoices/${id}/download-pdf`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(res.status === 404 ? 'Invoice not found' : `Couldn't generate the PDF (HTTP ${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
