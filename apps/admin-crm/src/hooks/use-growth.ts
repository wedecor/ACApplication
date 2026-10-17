'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type CampaignInput,
  type CampaignListQuery,
  type CouponInput,
  type CouponListQuery,
  growthApi,
  type ReferralListQuery,
  type ReferralStatus,
  type SegmentInput,
  type SegmentRules,
} from '@/lib/api/growth';
import { queryKeys } from '@/lib/api/query-keys';

function useInvalidateGrowth() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: queryKeys.growth.all });
}

// ------------------------------------------------------------------ coupons
export function useCoupons(query: CouponListQuery) {
  return useQuery({
    queryKey: queryKeys.growth.coupons(query as Record<string, unknown>),
    queryFn: () => growthApi.listCoupons(query),
    placeholderData: keepPreviousData,
  });
}

export function useCouponRedemptions(id: string | null, page = 1) {
  return useQuery({
    queryKey: queryKeys.growth.redemptions(id ?? 'none', { page }),
    queryFn: () => growthApi.couponRedemptions(id!, { page, pageSize: 20 }),
    enabled: Boolean(id),
  });
}

export function useSaveCoupon() {
  const invalidate = useInvalidateGrowth();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: CouponInput }) =>
      id ? growthApi.updateCoupon(id, input) : growthApi.createCoupon(input),
    onSuccess: invalidate,
  });
}

export function useToggleCoupon() {
  const invalidate = useInvalidateGrowth();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      growthApi.updateCoupon(id, { isActive }),
    onSuccess: invalidate,
  });
}

export function useDeleteCoupon() {
  const invalidate = useInvalidateGrowth();
  return useMutation({ mutationFn: (id: string) => growthApi.deleteCoupon(id), onSuccess: invalidate });
}

// ---------------------------------------------------------------- referrals
export function useReferrals(query: ReferralListQuery) {
  return useQuery({
    queryKey: queryKeys.growth.referrals(query as Record<string, unknown>),
    queryFn: () => growthApi.listReferrals(query),
    placeholderData: keepPreviousData,
  });
}

export function useReferralStats() {
  return useQuery({ queryKey: queryKeys.growth.referralStats, queryFn: () => growthApi.referralStats() });
}

export function useOverrideReferral() {
  const invalidate = useInvalidateGrowth();
  return useMutation({
    mutationFn: ({ id, status, rewardMinor }: { id: string; status: ReferralStatus; rewardMinor?: number }) =>
      growthApi.overrideReferral(id, { status, rewardMinor }),
    onSuccess: invalidate,
  });
}

// ----------------------------------------------------------------- segments
export function useSegments(query: { page?: number; pageSize?: number; search?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.growth.segments(query),
    queryFn: () => growthApi.listSegments(query),
  });
}

export function useSegmentRulesPreview(rules: SegmentRules, enabled = true) {
  return useQuery({
    queryKey: queryKeys.growth.segmentPreview(rules),
    queryFn: () => growthApi.previewRules(rules),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useSaveSegment() {
  const invalidate = useInvalidateGrowth();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: SegmentInput }) =>
      id ? growthApi.updateSegment(id, input) : growthApi.createSegment(input),
    onSuccess: invalidate,
  });
}

export function useDeleteSegment() {
  const invalidate = useInvalidateGrowth();
  return useMutation({ mutationFn: (id: string) => growthApi.deleteSegment(id), onSuccess: invalidate });
}

export function usePreviewSegment() {
  const invalidate = useInvalidateGrowth();
  return useMutation({ mutationFn: (id: string) => growthApi.previewSegment(id), onSuccess: invalidate });
}

// ---------------------------------------------------------------- campaigns
export function useCampaigns(query: CampaignListQuery) {
  return useQuery({
    queryKey: queryKeys.growth.campaigns(query as Record<string, unknown>),
    queryFn: () => growthApi.listCampaigns(query),
    placeholderData: keepPreviousData,
  });
}

export function useCampaign(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.growth.campaign(id ?? 'new'),
    queryFn: () => growthApi.getCampaign(id!),
    enabled: Boolean(id),
  });
}

export function useSaveCampaign() {
  const invalidate = useInvalidateGrowth();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: CampaignInput }) =>
      id ? growthApi.updateCampaign(id, input) : growthApi.createCampaign(input),
    onSuccess: invalidate,
  });
}

export function useCampaignAction() {
  const invalidate = useInvalidateGrowth();
  return useMutation({
    mutationFn: (args: { id: string; action: 'send' | 'cancel' | 'delete' } | { id: string; action: 'schedule'; scheduledAt: string }) => {
      switch (args.action) {
        case 'send':
          return growthApi.sendCampaign(args.id);
        case 'cancel':
          return growthApi.cancelCampaign(args.id);
        case 'delete':
          return growthApi.deleteCampaign(args.id);
        case 'schedule':
          return growthApi.scheduleCampaign(args.id, args.scheduledAt);
      }
    },
    onSuccess: invalidate,
  });
}

// ---------------------------------------------------------------- analytics
export function useNpsSummary(range: { from?: string; to?: string } = {}) {
  return useQuery({ queryKey: queryKeys.growth.nps(range), queryFn: () => growthApi.nps(range) });
}

export function useLoyalty(customerId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.growth.loyalty(customerId ?? 'none'),
    queryFn: () => growthApi.loyalty(customerId!),
    enabled: Boolean(customerId),
  });
}

export function useAdjustLoyalty(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { points: number; reason: string }) => growthApi.adjustLoyalty(customerId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.growth.loyalty(customerId) });
      void qc.invalidateQueries({ queryKey: queryKeys.customers.detail(customerId) });
    },
  });
}
