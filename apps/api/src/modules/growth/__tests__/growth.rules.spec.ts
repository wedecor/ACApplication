import {
  buildSegmentWhere,
  computeCouponDiscount,
  type CouponLike,
  evaluateCoupon,
  generateReferralCode,
  isOptedOut,
  loyaltyPointsFor,
  normaliseCouponCode,
  parseSegmentRules,
  summariseNps,
} from '../growth.rules';

const now = new Date('2026-06-01T10:00:00Z');

function coupon(over: Partial<CouponLike> = {}): CouponLike {
  return {
    discountType: 'PERCENT',
    discountValue: 1000,
    maxDiscountMinor: null,
    minOrderMinor: 0,
    validFrom: new Date('2026-01-01T00:00:00Z'),
    validUntil: null,
    usageLimit: null,
    perCustomerLimit: 1,
    usedCount: 0,
    categories: [],
    firstBookingOnly: false,
    isActive: true,
    ...over,
  };
}

const ctx = { now, customerRedemptions: 0, completedBookings: 0 };

describe('computeCouponDiscount', () => {
  it('applies percent in basis points and caps by maxDiscount', () => {
    expect(computeCouponDiscount(coupon(), 50_000)).toBe(5_000);
    expect(computeCouponDiscount(coupon({ maxDiscountMinor: 2_000 }), 50_000)).toBe(2_000);
  });
  it('never exceeds the order amount for flat coupons', () => {
    expect(computeCouponDiscount(coupon({ discountType: 'FLAT', discountValue: 30_000 }), 20_000)).toBe(20_000);
    expect(computeCouponDiscount(coupon({ discountType: 'FLAT', discountValue: 10_000 }), null)).toBe(10_000);
  });
  it('returns 0 for percent coupons when the amount is unknown', () => {
    expect(computeCouponDiscount(coupon(), null)).toBe(0);
  });
});

describe('evaluateCoupon', () => {
  it('accepts a valid coupon', () => {
    expect(evaluateCoupon(coupon(), { ...ctx, amountMinor: 10_000 })).toEqual({
      valid: true,
      discountMinor: 1_000,
      message: undefined,
    });
  });
  it('rejects missing / inactive / deleted coupons', () => {
    expect(evaluateCoupon(null, ctx).valid).toBe(false);
    expect(evaluateCoupon(coupon({ isActive: false }), ctx).message).toMatch(/not active/);
    expect(evaluateCoupon(coupon({ deletedAt: now }), ctx).valid).toBe(false);
  });
  it('honours the validity window', () => {
    expect(evaluateCoupon(coupon({ validFrom: new Date('2026-07-01') }), ctx).message).toMatch(/not yet/);
    expect(evaluateCoupon(coupon({ validUntil: new Date('2026-05-01') }), ctx).message).toMatch(/expired/);
  });
  it('honours global and per-customer limits', () => {
    expect(evaluateCoupon(coupon({ usageLimit: 5, usedCount: 5 }), ctx).message).toMatch(/limit/);
    expect(evaluateCoupon(coupon(), { ...ctx, customerRedemptions: 1 }).message).toMatch(/already used/);
    expect(evaluateCoupon(coupon({ perCustomerLimit: 0 }), { ...ctx, customerRedemptions: 9 }).valid).toBe(true);
  });
  it('restricts categories', () => {
    const c = coupon({ categories: ['AC_REPAIR'] });
    expect(evaluateCoupon(c, ctx).valid).toBe(false);
    expect(evaluateCoupon(c, { ...ctx, category: 'GEYSER' }).valid).toBe(false);
    expect(evaluateCoupon(c, { ...ctx, category: 'AC_REPAIR' }).valid).toBe(true);
  });
  it('enforces first-booking-only and minimum order', () => {
    expect(evaluateCoupon(coupon({ firstBookingOnly: true }), { ...ctx, completedBookings: 1 }).message).toMatch(/first booking/);
    expect(evaluateCoupon(coupon({ minOrderMinor: 50_000 }), { ...ctx, amountMinor: 40_000 }).message).toMatch(/Minimum/);
    expect(evaluateCoupon(coupon({ minOrderMinor: 50_000 }), { ...ctx, amountMinor: 50_000 }).valid).toBe(true);
  });
});

describe('normaliseCouponCode', () => {
  it('upper-cases and strips whitespace', () => {
    expect(normaliseCouponCode('  welcome 100 ')).toBe('WELCOME100');
  });
});

describe('segment rules', () => {
  it('drops unknown/invalid keys and lower-cases tags', () => {
    expect(
      parseSegmentRules({ tags: ['VIP', '', 3], minBookings: '2', maxBookings: -1, amcStatus: 'bogus', foo: 1 }),
    ).toEqual({ tags: ['vip'], minBookings: 2 });
    expect(parseSegmentRules(null)).toEqual({});
  });

  it('always scopes to tenant, non-deleted, non-merged customers', () => {
    const where = buildSegmentWhere('t1', {}, now);
    expect(where).toEqual({ AND: [{ tenantId: 't1', deletedAt: null, mergedIntoId: null }] });
  });

  it('builds filters for every rule', () => {
    const where = buildSegmentWhere(
      't1',
      {
        cityIds: ['c1'],
        tags: ['vip'],
        categories: ['AC_REPAIR'],
        minBookings: 1,
        maxBookings: 5,
        lastBookingBeforeDays: 30,
        amcStatus: 'expired',
        applianceWarrantyExpiringInDays: 15,
      },
      now,
    );
    const and = where.AND as unknown[];
    expect(and).toContainEqual({ cityId: { in: ['c1'] } });
    expect(and).toContainEqual({ tags: { hasSome: ['vip'] } });
    expect(and).toContainEqual({ totalBookings: { gte: 1, lte: 5 } });
    expect(and).toContainEqual({
      bookings: { none: { deletedAt: null, scheduledAt: { gte: new Date('2026-05-02T10:00:00Z') } } },
    });
    expect(and).toContainEqual({ amcSubscriptions: { none: { deletedAt: null, status: 'ACTIVE' } } });
    expect(JSON.stringify(and)).toContain('manufacturerWarrantyUntil');
  });

  it('maps amcStatus none / active', () => {
    expect(buildSegmentWhere('t', { amcStatus: 'none' }, now).AND).toContainEqual({
      amcSubscriptions: { none: { deletedAt: null } },
    });
    expect(buildSegmentWhere('t', { amcStatus: 'active' }, now).AND).toContainEqual({
      amcSubscriptions: { some: { deletedAt: null, status: 'ACTIVE' } },
    });
  });
});

describe('loyaltyPointsFor', () => {
  it('earns per full ₹100', () => {
    expect(loyaltyPointsFor(9_999, 1)).toBe(0);
    expect(loyaltyPointsFor(25_000, 1)).toBe(2);
    expect(loyaltyPointsFor(25_000, 3)).toBe(6);
    expect(loyaltyPointsFor(-5, 1)).toBe(0);
  });
});

describe('summariseNps', () => {
  it('buckets scores and computes NPS', () => {
    expect(summariseNps([10, 9, 8, 7, 6, 0])).toEqual({
      total: 6,
      promoters: 2,
      passives: 2,
      detractors: 2,
      score: 0,
    });
    expect(summariseNps([10, 10, 3]).score).toBe(33);
    expect(summariseNps([]).score).toBe(0);
  });
});

describe('isOptedOut', () => {
  it('honours marketing and channel opt-outs', () => {
    expect(isOptedOut({ marketingOptOut: true }, 'SMS', 'marketing')).toBe(true);
    expect(isOptedOut({ marketingOptOut: true }, 'SMS', 'transactional')).toBe(false);
    expect(isOptedOut({ optOut: { whatsapp: true } }, 'WHATSAPP', 'transactional')).toBe(true);
    expect(isOptedOut({ channels: { sms: false } }, 'SMS', 'marketing')).toBe(true);
    expect(isOptedOut({ notifications: { marketing: false } }, 'EMAIL', 'marketing')).toBe(true);
    expect(isOptedOut({}, 'SMS', 'marketing')).toBe(false);
    expect(isOptedOut(null, 'SMS', 'marketing')).toBe(false);
  });
});

describe('generateReferralCode', () => {
  it('produces random codes from an unambiguous alphabet', () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateReferralCode()));
    expect(codes.size).toBe(200);
    for (const c of codes) expect(c).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });
});
