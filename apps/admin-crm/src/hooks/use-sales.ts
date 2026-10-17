'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/api/query-keys';
import {
  type AccountInput,
  type AccountListQuery,
  type OpportunityInput,
  type OpportunityListQuery,
  type OpportunityStage,
  salesApi,
} from '@/lib/api/sales';

export function useAccounts(query: AccountListQuery) {
  return useQuery({
    queryKey: queryKeys.sales.accounts(query as Record<string, unknown>),
    queryFn: () => salesApi.listAccounts(query),
    placeholderData: keepPreviousData,
  });
}

export function useAccount(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.sales.account(id ?? 'none'),
    queryFn: () => salesApi.getAccount(id!),
    enabled: Boolean(id),
  });
}

function useInvalidateAccounts() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.sales.accountsAll });
    void qc.invalidateQueries({ queryKey: ['sales', 'account'] });
    void qc.invalidateQueries({ queryKey: queryKeys.customers.all });
  };
}

export function useSaveAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: AccountInput }) =>
      id ? salesApi.updateAccount(id, input) : salesApi.createAccount(input),
    onSuccess: invalidate,
  });
}

export function useDeleteAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation({ mutationFn: (id: string) => salesApi.deleteAccount(id), onSuccess: invalidate });
}

export function useLinkAccountCustomers(accountId: string) {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: (customerIds: string[]) => salesApi.linkCustomers(accountId, customerIds),
    onSuccess: invalidate,
  });
}

export function useUnlinkAccountCustomer(accountId: string) {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: (customerId: string) => salesApi.unlinkCustomer(accountId, customerId),
    onSuccess: invalidate,
  });
}

export function useOpportunities(query: OpportunityListQuery) {
  return useQuery({
    queryKey: queryKeys.sales.opportunities(query as Record<string, unknown>),
    queryFn: () => salesApi.listOpportunities(query),
    placeholderData: keepPreviousData,
  });
}

export function usePipeline(query: { ownerUserId?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.sales.pipeline(query),
    queryFn: () => salesApi.pipeline(query),
  });
}

function useInvalidateOpportunities() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.sales.opportunitiesAll });
    void qc.invalidateQueries({ queryKey: ['sales', 'account'] });
  };
}

export function useSaveOpportunity() {
  const invalidate = useInvalidateOpportunities();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: OpportunityInput }) =>
      id ? salesApi.updateOpportunity(id, input) : salesApi.createOpportunity(input),
    onSuccess: invalidate,
  });
}

export function useOpportunityFromLead() {
  const invalidate = useInvalidateOpportunities();
  return useMutation({
    mutationFn: ({ leadId, ...input }: { leadId: string; title?: string; valueMinor?: number; accountId?: string }) =>
      salesApi.createFromLead(leadId, input),
    onSuccess: invalidate,
  });
}

export function useMoveOpportunityStage() {
  const invalidate = useInvalidateOpportunities();
  return useMutation({
    mutationFn: ({ id, stage, lostReason }: { id: string; stage: OpportunityStage; lostReason?: string }) =>
      salesApi.moveStage(id, { stage, lostReason }),
    onSuccess: invalidate,
  });
}

export function useDeleteOpportunity() {
  const invalidate = useInvalidateOpportunities();
  return useMutation({ mutationFn: (id: string) => salesApi.deleteOpportunity(id), onSuccess: invalidate });
}
