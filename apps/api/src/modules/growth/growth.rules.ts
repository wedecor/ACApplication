/**
 * Pure growth rules — coupon evaluation, segment → Prisma filter, loyalty
 * accrual, NPS buckets, opt-out checks and referral code generation. Kept
 * free of Nest/Prisma runtime dependencies so they are trivially unit-tested.
 */
import { randomInt } from 'node:crypto';

import type { Prisma } from '@ac/database';

// ------------------------------------------------------------------ coupons

export interface CouponLike {
  discountType: 'PERCENT' | 'FLAT';
  discountValue: number;
  maxDiscountMinor: number | null;
  minOrderMinor: number;
  validFrom: Date;
  validUntil: Date | null;
  usageLimit: number | null;
  perCustomerLimit: number;
  usedCount: number;
  categories: string[];
  firstBookingOnly: boolean;
  isActive: boolean;
  deletedAt?: Date | null;
}

export interface CouponContext {
  now: Date;
  category?: string | null;
  amountMinor?: number | null;
  /** Redemptions already made by this customer for this coupon. */
  customerRedemptions: number;
  /** Completed bookings the customer already has (excluding the one being priced). */
  completedBookings: number;
}

export interface CouponEvaluation {
  valid: boolean;
  discountMinor: number;
  message?: string;
}

export function computeCouponDiscount(coupon: CouponLike, amountMinor: number | null | undefined): number {
  const amount = amountMinor ?? null;
  let discount: number;
  if (coupon.discountType === 'PERCENT') {
    if (amount === null) return 0;
    discount = Math.floor((amount * coupon.discountValue) / 10_000);
  } else {
    discount = coupon.discountValue;
  }
  if (coupon.maxDiscountMinor !== null && coupon.maxDiscountMinor >= 0) {
    discount = Math.min(discount, coupon.maxDiscountMinor);
  }
  if (amount !== null) discount = Math.min(discount, amount);
  return Math.max(0, Math.floor(discount));
}

export function evaluateCoupon(coupon: CouponLike | null, ctx: CouponContext): CouponEvaluation {
  const invalid = (message: string): CouponEvaluation => ({ valid: false, discountMinor: 0, message });
  if (!coupon || coupon.deletedAt) return invalid('Coupon not found');
  if (!coupon.isActive) return invalid('Coupon is not active');
  if (coupon.validFrom.getTime() > ctx.now.getTime()) return invalid('Coupon is not yet valid');
  if (coupon.validUntil && coupon.validUntil.getTime() < ctx.now.getTime()) {
    return invalid('Coupon has expired');
  }
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return invalid('Coupon usage limit reached');
  }
  if (coupon.perCustomerLimit > 0 && ctx.customerRedemptions >= coupon.perCustomerLimit) {
    return invalid('You have already used this coupon');
  }
  if (coupon.categories.length > 0) {
    if (!ctx.category) return invalid('Coupon applies to specific services only');
    if (!coupon.categories.includes(ctx.category)) {
      return invalid('Coupon is not valid for this service');
    }
  }
  if (coupon.firstBookingOnly && ctx.completedBookings > 0) {
    return invalid('Coupon is valid on your first booking only');
  }
  const amount = ctx.amountMinor ?? null;
  if (amount !== null && amount < coupon.minOrderMinor) {
    return invalid(`Minimum order value is ₹${(coupon.minOrderMinor / 100).toFixed(0)}`);
  }
  const discountMinor = computeCouponDiscount(coupon, amount);
  return {
    valid: true,
    discountMinor,
    message: amount === null && coupon.discountType === 'PERCENT'
      ? `${coupon.discountValue / 100}% off will be applied to your bill`
      : undefined,
  };
}

export function normaliseCouponCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

// ----------------------------------------------------------------- segments

export interface SegmentRules {
  cityIds?: string[];
  tags?: string[];
  categories?: string[];
  minBookings?: number;
  maxBookings?: number;
  lastBookingBeforeDays?: number;
  amcStatus?: 'active' | 'expired' | 'none';
  applianceWarrantyExpiringInDays?: number;
}

const DAY_MS = 86_400_000;

function strArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim());
  return out.length ? out : undefined;
}

function nonNegInt(v: unknown): number | undefined {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : undefined;
}

/** Sanitise arbitrary JSON into a SegmentRules object (unknown keys dropped). */
export function parseSegmentRules(input: unknown): SegmentRules {
  const src = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const rules: SegmentRules = {};
  const cityIds = strArray(src.cityIds);
  if (cityIds) rules.cityIds = cityIds;
  const tags = strArray(src.tags);
  if (tags) rules.tags = tags.map((t) => t.toLowerCase());
  const categories = strArray(src.categories);
  if (categories) rules.categories = categories;
  const minBookings = nonNegInt(src.minBookings);
  if (minBookings !== undefined) rules.minBookings = minBookings;
  const maxBookings = nonNegInt(src.maxBookings);
  if (maxBookings !== undefined) rules.maxBookings = maxBookings;
  const lastBookingBeforeDays = nonNegInt(src.lastBookingBeforeDays);
  if (lastBookingBeforeDays !== undefined) rules.lastBookingBeforeDays = lastBookingBeforeDays;
  const amc = src.amcStatus;
  if (amc === 'active' || amc === 'expired' || amc === 'none') rules.amcStatus = amc;
  const warranty = nonNegInt(src.applianceWarrantyExpiringInDays);
  if (warranty !== undefined) rules.applianceWarrantyExpiringInDays = warranty;
  return rules;
}

export function buildSegmentWhere(
  tenantId: string,
  rules: SegmentRules,
  now: Date = new Date(),
): Prisma.CustomerWhereInput {
  const and: Prisma.CustomerWhereInput[] = [{ tenantId, deletedAt: null, mergedIntoId: null }];

  if (rules.cityIds?.length) and.push({ cityId: { in: rules.cityIds } });
  if (rules.tags?.length) and.push({ tags: { hasSome: rules.tags } });
  if (rules.categories?.length) {
    and.push({
      bookings: {
        some: { deletedAt: null, category: { in: rules.categories as Prisma.EnumServiceCategoryFilter['in'] } },
      },
    });
  }
  if (rules.minBookings !== undefined || rules.maxBookings !== undefined) {
    and.push({
      totalBookings: {
        ...(rules.minBookings !== undefined ? { gte: rules.minBookings } : {}),
        ...(rules.maxBookings !== undefined ? { lte: rules.maxBookings } : {}),
      },
    });
  }
  if (rules.lastBookingBeforeDays !== undefined) {
    const cutoff = new Date(now.getTime() - rules.lastBookingBeforeDays * DAY_MS);
    and.push({ bookings: { some: { deletedAt: null } } });
    and.push({ bookings: { none: { deletedAt: null, scheduledAt: { gte: cutoff } } } });
  }
  if (rules.amcStatus === 'active') {
    and.push({ amcSubscriptions: { some: { deletedAt: null, status: 'ACTIVE' } } });
  } else if (rules.amcStatus === 'expired') {
    and.push({ amcSubscriptions: { some: { deletedAt: null, status: 'EXPIRED' } } });
    and.push({ amcSubscriptions: { none: { deletedAt: null, status: 'ACTIVE' } } });
  } else if (rules.amcStatus === 'none') {
    and.push({ amcSubscriptions: { none: { deletedAt: null } } });
  }
  if (rules.applianceWarrantyExpiringInDays !== undefined) {
    const until = new Date(now.getTime() + rules.applianceWarrantyExpiringInDays * DAY_MS);
    const window = { gte: now, lte: until };
    and.push({
      appliances: {
        some: {
          deletedAt: null,
          OR: [{ manufacturerWarrantyUntil: window }, { extendedWarrantyUntil: window }],
        },
      },
    });
  }
  return { AND: and };
}

// ------------------------------------------------------------------ loyalty

/** Points earned for a paid amount: `pointsPer100` per full ₹100 (10 000 paise). */
export function loyaltyPointsFor(paidMinor: number, pointsPer100: number): number {
  if (!Number.isFinite(paidMinor) || paidMinor <= 0 || pointsPer100 <= 0) return 0;
  return Math.floor(paidMinor / 10_000) * pointsPer100;
}

// ---------------------------------------------------------------------- NPS

export interface NpsSummary {
  total: number;
  promoters: number;
  passives: number;
  detractors: number;
  score: number;
}

export function summariseNps(scores: readonly number[]): NpsSummary {
  let promoters = 0;
  let passives = 0;
  let detractors = 0;
  for (const s of scores) {
    if (s >= 9) promoters += 1;
    else if (s >= 7) passives += 1;
    else detractors += 1;
  }
  const total = scores.length;
  const score = total === 0 ? 0 : Math.round(((promoters - detractors) / total) * 100);
  return { total, promoters, passives, detractors, score };
}

// ------------------------------------------------------------------ opt-out

/**
 * Customer.preferences conventions honoured (any one opts the customer out):
 *   { marketingOptOut: true }                 — all marketing
 *   { optOut: { whatsapp: true } }            — one channel (any kind)
 *   { channels: { sms: false } }              — one channel (any kind)
 *   { notifications: { marketing: false } }   — all marketing
 */
export function isOptedOut(
  preferences: unknown,
  channel: string,
  kind: 'marketing' | 'transactional',
): boolean {
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) return false;
  const p = preferences as Record<string, unknown>;
  const ch = channel.toLowerCase();
  const obj = (v: unknown): Record<string, unknown> | null =>
    v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

  if (obj(p.optOut)?.[ch] === true) return true;
  if (obj(p.channels)?.[ch] === false) return true;
  if (kind === 'marketing') {
    if (p.marketingOptOut === true) return true;
    if (obj(p.notifications)?.marketing === false) return true;
  }
  return false;
}

// ----------------------------------------------------------- referral codes

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Random, unguessable referral code (8 chars from a 32-symbol alphabet ≈ 40 bits). */
export function generateReferralCode(length = 8): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}
