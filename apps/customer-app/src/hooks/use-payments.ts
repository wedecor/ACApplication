import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { paymentsApi } from '@/api/endpoints';
import { qk } from '@/api/keys';

export function usePaymentMethods() {
  return useQuery({
    queryKey: qk.paymentMethods(),
    queryFn: () => paymentsApi.methods(),
    staleTime: 5 * 60_000,
  });
}

export function useRefunds() {
  return useQuery({
    queryKey: qk.refunds(),
    queryFn: () => paymentsApi.refunds(),
    staleTime: 60_000,
  });
}

export function useSetDefaultPaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => paymentsApi.setDefault(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.paymentMethods() }),
  });
}

export function useRemovePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => paymentsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.paymentMethods() }),
  });
}
