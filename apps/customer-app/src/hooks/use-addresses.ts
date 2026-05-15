import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { addressesApi } from '@/api/endpoints';
import { qk } from '@/api/keys';

import type { CustomerAddress } from '@/api/types';

export function useAddresses() {
  return useQuery({
    queryKey: qk.addresses(),
    queryFn: () => addressesApi.list(),
    staleTime: 5 * 60_000,
  });
}

export function useCreateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<CustomerAddress, 'id' | 'isDefault'> & { setDefault?: boolean }) =>
      addressesApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.addresses() }),
  });
}

export function useSetDefaultAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => addressesApi.setDefault(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.addresses() }),
  });
}

export function useDeleteAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => addressesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.addresses() }),
  });
}
