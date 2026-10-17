'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type CustomFieldEntity,
  type CustomFieldInput,
  customFieldsApi,
  type CustomFieldUpdate,
} from '@/lib/api/custom-fields';
import { queryKeys } from '@/lib/api/query-keys';

export function useCustomFieldDefinitions(entity?: CustomFieldEntity, includeInactive = false) {
  return useQuery({
    queryKey: queryKeys.customFields.list({ entity, includeInactive }),
    queryFn: () => customFieldsApi.list({ entity, includeInactive: includeInactive || undefined }),
    staleTime: 60_000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: queryKeys.customFields.all });
}

export function useCreateCustomField() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CustomFieldInput) => customFieldsApi.create(input),
    onSuccess: invalidate,
  });
}

export function useUpdateCustomField() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CustomFieldUpdate }) =>
      customFieldsApi.update(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteCustomField() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (id: string) => customFieldsApi.remove(id), onSuccess: invalidate });
}
