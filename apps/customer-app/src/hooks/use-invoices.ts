import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { invoicesApi } from '@/api/endpoints';
import { qk } from '@/api/keys';

export function useInvoices() {
  return useQuery({
    queryKey: qk.invoices(),
    queryFn: () => invoicesApi.list(),
    staleTime: 30_000,
  });
}

export function useInvoiceDetail(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.invoiceDetail(id) : ['invoices', 'detail', 'none'],
    queryFn: () => invoicesApi.detail(id!),
    enabled: !!id,
  });
}

export function usePayInvoice() {
  return useMutation({
    mutationFn: ({ id, gateway, methodId }: { id: string; gateway: 'razorpay' | 'stripe'; methodId?: string }) =>
      invoicesApi.pay(id, { gateway, methodId }),
  });
}

export function useConfirmInvoicePayment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => invoicesApi.confirm(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.invoices() });
      qc.invalidateQueries({ queryKey: qk.invoiceDetail(id) });
    },
  });
}
