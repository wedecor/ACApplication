'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { type FinanceRangeQuery, financeApi, ledgerApi } from '@/lib/api/finance';
import {
  type CreateInvoiceInput,
  invoicesApi,
  type ListInvoicesParams,
} from '@/lib/api/invoices';
import {
  type CreateQuotationInput,
  type ListQuotationsParams,
  quotationsApi,
} from '@/lib/api/quotations';
import { paymentsApi, type PaymentTransactionStatus } from '@/lib/api/payments';
import { amcApi, type AMCSubscriptionStatus, type AmcPlan } from '@/lib/api/amc';
import { payoutsApi, type PayoutStatus } from '@/lib/api/payouts';
import { queryKeys } from '@/lib/api/query-keys';

// ----------------------------------------------------------------- INVOICES

export function useInvoices(params: ListInvoicesParams) {
  return useQuery({
    queryKey: queryKeys.invoices.list(params as Record<string, unknown>),
    queryFn: () => invoicesApi.list(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.invoices.detail(id) : ['invoices', 'detail', 'noop'],
    queryFn: () => invoicesApi.detail(id!),
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInvoiceInput) => invoicesApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.invoices.all }),
  });
}

export function useInvoiceAction(id: string) {
  const qc = useQueryClient();
  const invalidate = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.invoices.all }),
      qc.invalidateQueries({ queryKey: queryKeys.invoices.detail(id) }),
    ]);
  return {
    send: useMutation({
      mutationFn: () => invoicesApi.send(id),
      onSuccess: invalidate,
    }),
    cancel: useMutation({
      mutationFn: (reason?: string) => invoicesApi.cancel(id, reason),
      onSuccess: invalidate,
    }),
    recordPayment: useMutation({
      mutationFn: (body: {
        amountMinor: number;
        method: string;
        gatewayRef?: string;
        notes?: string;
      }) => invoicesApi.recordPayment(id, body),
      onSuccess: invalidate,
    }),
    refund: useMutation({
      mutationFn: (body: { amountMinor: number; paymentId?: string; reason?: string }) =>
        invoicesApi.refund(id, body),
      onSuccess: invalidate,
    }),
    duplicate: useMutation({
      mutationFn: () => invoicesApi.duplicate(id),
      onSuccess: invalidate,
    }),
  };
}

// -------------------------------------------------------------- QUOTATIONS

export function useQuotations(params: ListQuotationsParams) {
  return useQuery({
    queryKey: queryKeys.quotations.list(params as Record<string, unknown>),
    queryFn: () => quotationsApi.list(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useQuotation(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.quotations.detail(id) : ['quotations', 'detail', 'noop'],
    queryFn: () => quotationsApi.detail(id!),
    enabled: !!id,
  });
}

export function useCreateQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateQuotationInput) => quotationsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.quotations.all }),
  });
}

export function useQuotationAction(id: string) {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: queryKeys.quotations.detail(id) });
  return {
    send: useMutation({ mutationFn: () => quotationsApi.send(id), onSuccess: invalidate }),
    convert: useMutation({ mutationFn: () => quotationsApi.convert(id), onSuccess: invalidate }),
  };
}

// --------------------------------------------------------------- PAYMENTS

export function usePaymentHistory(params: {
  page?: number;
  pageSize?: number;
  status?: PaymentTransactionStatus;
  customerId?: string;
  invoiceId?: string;
}) {
  return useQuery({
    queryKey: queryKeys.payments.history(params as Record<string, unknown>),
    queryFn: () => paymentsApi.history(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useCreatePaymentLink() {
  return useMutation({
    mutationFn: (body: {
      invoiceId: string;
      amountMinor?: number;
      provider?: 'razorpay' | 'stripe';
      description?: string;
      callbackUrl?: string;
    }) => paymentsApi.createLink(body),
  });
}

// -------------------------------------------------------------------- AMC

export function useAmcPlans() {
  return useQuery({
    queryKey: queryKeys.amc.plans,
    queryFn: () => amcApi.listPlans(),
    staleTime: 60_000,
  });
}

export function useAmcSubscriptions(params: {
  status?: AMCSubscriptionStatus;
  customerId?: string;
}) {
  return useQuery({
    queryKey: queryKeys.amc.subscriptions(params as Record<string, unknown>),
    queryFn: () => amcApi.listSubscriptions(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useAmcSubscription(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.amc.subscription(id) : ['amc', 'subscription', 'noop'],
    queryFn: () => amcApi.getSubscription(id!),
    enabled: !!id,
  });
}

export function useSubscribeAmc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { customerId: string; planId: string; autoRenew?: boolean }) =>
      amcApi.subscribe(body),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['amc', 'subscriptions'] }),
        qc.invalidateQueries({ queryKey: queryKeys.invoices.all }),
      ]),
  });
}

export function useCreateAmcPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<AmcPlan> & Pick<AmcPlan, 'slug' | 'name' | 'type'>) =>
      amcApi.createPlan(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.amc.plans }),
  });
}

// ----------------------------------------------------------------- PAYOUTS

export function usePayouts(params: { status?: PayoutStatus; technicianId?: string }) {
  return useQuery({
    queryKey: queryKeys.payouts.list(params as Record<string, unknown>),
    queryFn: () => payoutsApi.list(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function usePayout(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.payouts.detail(id) : ['payouts', 'detail', 'noop'],
    queryFn: () => payoutsApi.detail(id!),
    enabled: !!id,
  });
}

export function usePayoutAction(id: string) {
  const qc = useQueryClient();
  const invalidate = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['payouts'] }),
      qc.invalidateQueries({ queryKey: queryKeys.payouts.detail(id) }),
    ]);
  return {
    approve: useMutation({
      mutationFn: (notes?: string) => payoutsApi.approve(id, notes),
      onSuccess: invalidate,
    }),
    markPaid: useMutation({
      mutationFn: (body: { paymentRef?: string; notes?: string }) =>
        payoutsApi.markPaid(id, body),
      onSuccess: invalidate,
    }),
    fail: useMutation({
      mutationFn: (reason: string) => payoutsApi.fail(id, reason),
      onSuccess: invalidate,
    }),
  };
}

// -------------------------------------------------------- ANALYTICS / LEDGER

export function useFinanceOverview(range: FinanceRangeQuery) {
  return useQuery({
    queryKey: queryKeys.finance.overview(range),
    queryFn: () => financeApi.overview(range),
    staleTime: 30_000,
  });
}

export function useRevenueSeries(range: FinanceRangeQuery) {
  return useQuery({
    queryKey: queryKeys.finance.revenue(range),
    queryFn: () => financeApi.revenueSeries(range),
    staleTime: 30_000,
  });
}

export function useTopCustomers(range: FinanceRangeQuery) {
  return useQuery({
    queryKey: queryKeys.finance.topCustomers(range),
    queryFn: () => financeApi.topCustomers(range),
    staleTime: 60_000,
  });
}

export function useRevenueByCity(range: FinanceRangeQuery) {
  return useQuery({
    queryKey: queryKeys.finance.byCity(range),
    queryFn: () => financeApi.revenueByCity(range),
    staleTime: 60_000,
  });
}

export function useAging() {
  return useQuery({
    queryKey: queryKeys.finance.aging,
    queryFn: () => financeApi.aging(),
    staleTime: 60_000,
  });
}

export function usePayoutPipeline() {
  return useQuery({
    queryKey: queryKeys.finance.payoutPipeline,
    queryFn: () => financeApi.payoutPipeline(),
    staleTime: 60_000,
  });
}

export function useLedger(customerId: string | undefined, range?: FinanceRangeQuery) {
  return useQuery({
    queryKey: customerId ? queryKeys.ledger.statement(customerId) : ['ledger', 'noop'],
    queryFn: () => ledgerApi.statement(customerId!, range),
    enabled: !!customerId,
  });
}
