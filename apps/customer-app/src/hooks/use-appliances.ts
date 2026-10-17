import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { appliancesApi } from '@/api/endpoints';
import { qk } from '@/api/keys';

import type { CustomerApplianceInput } from '@/api/types';

export function useAppliances(enabled = true) {
  return useQuery({
    queryKey: qk.appliances(),
    queryFn: () => appliancesApi.list(),
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useSaveAppliance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: CustomerApplianceInput }) =>
      id ? appliancesApi.update(id, body) : appliancesApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.appliances() }),
  });
}

export function useRemoveAppliance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => appliancesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.appliances() }),
  });
}
