import type { NotificationChannel, ServiceCategory } from '@ac/types';

import { apiFetch, type PaginatedResponse } from './client';

// ------------------------------------------------------------------ coupons
export type CouponDiscountType = 'PERCENT' | 'FLAT';

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  /** PERCENT: basis points (1000 = 10%). FLAT: minor units. */
  discountValue: number;
  maxDiscountMinor: number | null;
  minOrderMinor: number;
  validFrom: string;
  validUntil: string | null;
  usageLimit: number | null;
  perCustomerLimit: number;
  usedCount: number;
  categories: ServiceCategory[];
  firstBookingOnly: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { redemptions: number };
}

export interface CouponInput {
  code: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountMinor?: number | null;
  minOrderMinor?: number;
  validFrom?: string;
  validUntil?: string | null;
  usageLimit?: number | null;
  perCustomerLimit?: number;
  categories?: ServiceCategory[];
  firstBookingOnly?: boolean;
  isActive?: boolean;
}

export interface CouponListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
}

export interface CouponRedemption {
  id: string;
  customerId: string;
  customer: { id: string; fullName: string; phone: string } | null;
  bookingId: string | null;
  invoiceId: string | null;
  discountMinor: number;
  createdAt: string;
}

export interface CouponValidation {
  valid: boolean;
  discountMinor: number;
  message?: string;
}

// ---------------------------------------------------------------- referrals
export type ReferralStatus = 'PENDING' | 'QUALIFIED' | 'REWARDED' | 'REJECTED';

export interface ReferralRow {
  id: string;
  status: ReferralStatus;
  rewardMinor: number;
  code: string;
  createdAt: string;
  qualifiedAt: string | null;
  rewardedAt: string | null;
  qualifiedBookingId: string | null;
  referrer: { id: string; fullName: string; phone: string } | null;
  referred: { id: string; fullName: string; phone: string } | null;
}

export interface ReferralStats {
  total: number;
  pending: number;
  qualified: number;
  rewarded: number;
  rejected: number;
  totalRewardMinor: number;
}

export interface ReferralListQuery {
  page?: number;
  pageSize?: number;
  status?: ReferralStatus;
  search?: string;
}

// ----------------------------------------------------------------- segments
export type AmcStatusRule = 'active' | 'expired' | 'none';

export interface SegmentRules {
  cityIds?: string[];
  tags?: string[];
  categories?: ServiceCategory[];
  minBookings?: number;
  maxBookings?: number;
  lastBookingBeforeDays?: number;
  amcStatus?: AmcStatusRule;
  applianceWarrantyExpiringInDays?: number;
}

export interface Segment {
  id: string;
  name: string;
  description: string | null;
  rules: SegmentRules;
  memberCount: number;
  lastComputedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SegmentInput {
  name: string;
  description?: string;
  rules: SegmentRules;
}

export interface SegmentPreview {
  count: number;
  sample: {
    id: string;
    fullName: string;
    phone: string;
    email: string | null;
    cityId: string | null;
    tags: string[];
    totalBookings: number;
  }[];
}

// ---------------------------------------------------------------- campaigns
export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED';

export interface CampaignStats {
  targeted?: number;
  sent?: number;
  failed?: number;
  skippedOptOut?: number;
  converted?: number;
}

export interface Campaign {
  id: string;
  name: string;
  segmentId: string | null;
  channel: NotificationChannel;
  templateKey: string;
  message: string | null;
  couponId: string | null;
  status: CampaignStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  stats: CampaignStats;
  createdAt: string;
  updatedAt: string;
  segment?: { id: string; name: string } | null;
  coupon?: { id: string; code: string } | null;
}

export interface CampaignInput {
  name: string;
  segmentId?: string | null;
  channel: NotificationChannel;
  templateKey: string;
  message?: string;
  couponId?: string | null;
  scheduledAt?: string | null;
}

export interface CampaignListQuery {
  page?: number;
  pageSize?: number;
  status?: CampaignStatus;
}

// ---------------------------------------------------------------- analytics
export interface NpsSummary {
  total: number;
  promoters: number;
  passives: number;
  detractors: number;
  score: number;
  avgRating: number;
  reviewRequests: number;
}

export interface LoyaltySummary {
  balance: number;
  entries: { id: string; points: number; reason: string; createdAt: string }[];
}

export const growthApi = {
  // coupons
  listCoupons: (query: CouponListQuery = {}) =>
    apiFetch<PaginatedResponse<Coupon>>('/coupons', { query: query as Record<string, unknown> }),
  getCoupon: (id: string) => apiFetch<Coupon>(`/coupons/${id}`),
  createCoupon: (input: CouponInput) => apiFetch<Coupon>('/coupons', { method: 'POST', body: input }),
  updateCoupon: (id: string, input: Partial<CouponInput>) =>
    apiFetch<Coupon>(`/coupons/${id}`, { method: 'PATCH', body: input }),
  deleteCoupon: (id: string) => apiFetch<unknown>(`/coupons/${id}`, { method: 'DELETE' }),
  couponRedemptions: (id: string, query: { page?: number; pageSize?: number } = {}) =>
    apiFetch<PaginatedResponse<CouponRedemption>>(`/coupons/${id}/redemptions`, {
      query: query,
    }),
  validateCoupon: (input: {
    customerId: string;
    code: string;
    category?: ServiceCategory;
    amountMinor?: number;
  }) => apiFetch<CouponValidation>('/coupons/validate', { method: 'POST', body: input }),

  // referrals
  listReferrals: (query: ReferralListQuery = {}) =>
    apiFetch<PaginatedResponse<ReferralRow>>('/referrals', {
      query: query as Record<string, unknown>,
    }),
  referralStats: () => apiFetch<ReferralStats>('/referrals/stats'),
  overrideReferral: (id: string, input: { status: ReferralStatus; rewardMinor?: number }) =>
    apiFetch<ReferralRow>(`/referrals/${id}`, { method: 'PATCH', body: input }),

  // segments
  listSegments: (query: { page?: number; pageSize?: number; search?: string } = {}) =>
    apiFetch<PaginatedResponse<Segment>>('/segments', { query: query }),
  getSegment: (id: string) => apiFetch<Segment>(`/segments/${id}`),
  createSegment: (input: SegmentInput) =>
    apiFetch<Segment>('/segments', { method: 'POST', body: input }),
  updateSegment: (id: string, input: Partial<SegmentInput>) =>
    apiFetch<Segment>(`/segments/${id}`, { method: 'PATCH', body: input }),
  deleteSegment: (id: string) => apiFetch<unknown>(`/segments/${id}`, { method: 'DELETE' }),
  previewRules: (rules: SegmentRules) =>
    apiFetch<SegmentPreview>('/segments/preview', { method: 'POST', body: { rules } }),
  previewSegment: (id: string) =>
    apiFetch<SegmentPreview>(`/segments/${id}/preview`, { method: 'POST', body: {} }),

  // campaigns
  listCampaigns: (query: CampaignListQuery = {}) =>
    apiFetch<PaginatedResponse<Campaign>>('/campaigns', {
      query: query as Record<string, unknown>,
    }),
  getCampaign: (id: string) => apiFetch<Campaign>(`/campaigns/${id}`),
  createCampaign: (input: CampaignInput) =>
    apiFetch<Campaign>('/campaigns', { method: 'POST', body: input }),
  updateCampaign: (id: string, input: Partial<CampaignInput>) =>
    apiFetch<Campaign>(`/campaigns/${id}`, { method: 'PATCH', body: input }),
  deleteCampaign: (id: string) => apiFetch<unknown>(`/campaigns/${id}`, { method: 'DELETE' }),
  scheduleCampaign: (id: string, scheduledAt: string) =>
    apiFetch<Campaign>(`/campaigns/${id}/schedule`, { method: 'POST', body: { scheduledAt } }),
  sendCampaign: (id: string) =>
    apiFetch<Campaign>(`/campaigns/${id}/send`, { method: 'POST', body: {} }),
  cancelCampaign: (id: string) =>
    apiFetch<Campaign>(`/campaigns/${id}/cancel`, { method: 'POST', body: {} }),

  // analytics + loyalty
  nps: (range: { from?: string; to?: string } = {}) =>
    apiFetch<NpsSummary>('/growth/analytics/nps', { query: range }),
  loyalty: (customerId: string) => apiFetch<LoyaltySummary>(`/growth/loyalty/${customerId}`),
  adjustLoyalty: (customerId: string, input: { points: number; reason: string }) =>
    apiFetch<LoyaltySummary>(`/growth/loyalty/${customerId}/adjust`, {
      method: 'POST',
      body: input,
    }),
};
