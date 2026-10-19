import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { amcApi } from '@/api/endpoints';
import { qk } from '@/api/keys';
import { Events,track } from '@/lib/analytics';

export function useAmcPlans() {
  return useQuery({
    queryKey: qk.amcPlans(),
    queryFn: () => amcApi.plans(),
    staleTime: 5 * 60_000,
  });
}

export function useMyAmc() {
  return useQuery({
    queryKey: qk.amcMine(),
    queryFn: () => amcApi.mine(),
    staleTime: 60_000,
  });
}

export function usePurchaseAmc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { planId: string; appliances: string[]; addressId: string }) =>
      amcApi.purchase(body),
    onSuccess: (_, vars) => {
      track(Events.AmcPurchase, { planId: vars.planId });
      void qc.invalidateQueries({ queryKey: qk.amcMine() });
      void qc.invalidateQueries({ queryKey: qk.invoices() });
    },
  });
}

export function useRenewAmc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => amcApi.renew(id),
    onSuccess: (_, id) => {
      track(Events.AmcRenew, { subscriptionId: id });
      void qc.invalidateQueries({ queryKey: qk.amcMine() });
      void qc.invalidateQueries({ queryKey: qk.invoices() });
    },
  });
}
