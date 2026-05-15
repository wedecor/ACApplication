import { apiFetch } from './client';

export type PaymentTransactionStatus =
  | 'CREATED'
  | 'PENDING'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export interface PaymentTransactionRow {
  id: string;
  customerId: string;
  invoiceId: string | null;
  provider: 'razorpay' | 'stripe' | 'manual';
  method: string | null;
  status: PaymentTransactionStatus;
  amountMinor: number;
  currency: string;
  orderRef: string | null;
  paymentRef: string | null;
  hostedLink: string | null;
  failureReason: string | null;
  createdAt: string;
  capturedAt: string | null;
  customer?: { id: string; fullName: string };
}

export const paymentsApi = {
  history: (params: {
    page?: number;
    pageSize?: number;
    status?: PaymentTransactionStatus;
    customerId?: string;
    invoiceId?: string;
    provider?: 'razorpay' | 'stripe' | 'manual';
  }) =>
    apiFetch<{
      items: PaymentTransactionRow[];
      meta: { page: number; pageSize: number; total: number; totalPages: number };
    }>('/payments/history', { query: params as Record<string, unknown> }),
  createLink: (body: {
    invoiceId: string;
    amountMinor?: number;
    provider?: 'razorpay' | 'stripe';
    description?: string;
    callbackUrl?: string;
  }) =>
    apiFetch<{
      transaction: PaymentTransactionRow;
      hostedLink: string | null;
    }>('/payments/create-link', { method: 'POST', body }),
  refundPayment: (paymentId: string, amountMinor: number, reason?: string) =>
    apiFetch<unknown>(`/payments/refund/${paymentId}`, {
      method: 'POST',
      body: { amountMinor, reason },
    }),
};
