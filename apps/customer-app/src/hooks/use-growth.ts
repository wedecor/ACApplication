import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { couponsApi, referralsApi } from '@/api/endpoints';
import { qk } from '@/api/keys';

/** Referral programme — served by the growth module. */
export function useReferrals() {
  return useQuery({
    queryKey: qk.referrals(),
    queryFn: () => referralsApi.mine(),
    staleTime: 60_000,
  });
}

export function useApplyReferral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => referralsApi.apply(code.trim().toUpperCase()),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.referrals() }),
  });
}

export function useValidateCoupon() {
  return useMutation({
    mutationFn: (body: { code: string; category?: string; amountMinor?: number }) =>
      couponsApi.validate({ ...body, code: body.code.trim().toUpperCase() }),
  });
}
