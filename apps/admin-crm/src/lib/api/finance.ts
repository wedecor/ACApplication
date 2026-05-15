import { apiFetch } from './client';

export interface FinanceOverview {
  revenueMinor: number;
  outstandingMinor: number;
  collectedMinor: number;
  refundedMinor: number;
  gstCollectedMinor: number;
  invoicesIssued: number;
  invoicesPaid: number;
  invoicesOverdue: number;
  averageInvoiceMinor: number;
  paymentSuccessRate: number;
  refundRatio: number;
  pendingPayoutsMinor: number;
  activeSubscriptions: number;
  expiringIn14Days: number;
}

export interface RevenueSeriesPoint {
  day: string;
  revenueMinor: number;
  collectedMinor: number;
  taxMinor: number;
}

export interface TopCustomerRow {
  customerId: string;
  fullName: string;
  invoicedMinor: number;
  paidMinor: number;
  outstandingMinor: number;
  invoices: number;
}

export interface RevenueByCityRow {
  cityId: string;
  city: string;
  revenueMinor: number;
  bookings: number;
}

export interface AgingBucket {
  bucket: string;
  amountMinor: number;
  count: number;
}

export interface PayoutPipelineRow {
  status: string;
  count: number;
  totalMinor: number;
}

export interface FinanceRangeQuery {
  from?: string;
  to?: string;
}

export const financeApi = {
  overview: (range: FinanceRangeQuery) =>
    apiFetch<FinanceOverview>('/finance/overview', { query: range as Record<string, unknown> }),
  revenueSeries: (range: FinanceRangeQuery) =>
    apiFetch<RevenueSeriesPoint[]>('/finance/revenue-series', {
      query: range as Record<string, unknown>,
    }),
  topCustomers: (range: FinanceRangeQuery & { limit?: number }) =>
    apiFetch<TopCustomerRow[]>('/finance/top-customers', {
      query: range as Record<string, unknown>,
    }),
  revenueByCity: (range: FinanceRangeQuery) =>
    apiFetch<RevenueByCityRow[]>('/finance/revenue-by-city', {
      query: range as Record<string, unknown>,
    }),
  aging: () => apiFetch<AgingBucket[]>('/finance/aging'),
  payoutPipeline: () => apiFetch<PayoutPipelineRow[]>('/finance/payout-pipeline'),
};

export interface LedgerStatement {
  customerId: string;
  openingBalanceMinor: number;
  closingBalanceMinor: number;
  entries: Array<{
    id: string;
    occurredAt: string;
    entryType: string;
    direction: 'DEBIT' | 'CREDIT';
    amountMinor: number;
    runningBalanceMinor: number;
    description: string | null;
  }>;
}

export const ledgerApi = {
  statement: (customerId: string, range?: FinanceRangeQuery) =>
    apiFetch<LedgerStatement>(`/ledger/customer/${customerId}/statement`, {
      query: range as Record<string, unknown>,
    }),
};
