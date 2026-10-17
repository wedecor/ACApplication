import {
  computeEstimate,
  computeSlots,
  pickCatalogItem,
  timeSlotLabel,
  tzOffsetMinutes,
  zonedTimeToUtc,
} from '../me-scheduling';

describe('time helpers', () => {
  it('computes IST offset and wall-clock → UTC', () => {
    expect(tzOffsetMinutes(new Date('2026-01-01T00:00:00Z'), 'Asia/Kolkata')).toBe(330);
    expect(zonedTimeToUtc('2026-01-10', 8, 'Asia/Kolkata').toISOString()).toBe('2026-01-10T02:30:00.000Z');
  });
  it('formats a slot window', () => {
    const start = new Date('2026-01-10T02:30:00Z');
    const end = new Date('2026-01-10T05:30:00Z');
    expect(timeSlotLabel(start, end, 'Asia/Kolkata')).toBe('08:00-11:00');
    expect(timeSlotLabel(start, null, 'Asia/Kolkata')).toBe('08:00');
  });
});

describe('computeSlots', () => {
  const tz = 'Asia/Kolkata';
  it('marks windows full when booked >= capacity and respects lead time', () => {
    const slots = computeSlots({
      date: '2026-01-10',
      tz,
      technicians: [{ dailyCapacity: 8 }], // 2 per window
      bookings: [
        { scheduledAt: new Date('2026-01-10T03:00:00Z') },
        { scheduledAt: new Date('2026-01-10T04:00:00Z') }, // 08-11 window now full
        { scheduledAt: new Date('2026-01-10T06:00:00Z') }, // 11-14 has 1/2
      ],
      now: new Date('2026-01-10T05:00:00Z'), // 10:30 IST
    });
    expect(slots).toHaveLength(4);
    expect(slots[0]!.available).toBe(false); // full + past
    expect(slots[1]!.available).toBe(false); // starts 11:00, < 60 min lead
    expect(slots[2]!.available).toBe(true);
    expect(slots[3]!.start).toBe('2026-01-10T11:30:00.000Z');
  });
  it('has no availability without skilled technicians', () => {
    const slots = computeSlots({ date: '2026-01-10', tz, technicians: [], bookings: [], now: new Date('2026-01-01T00:00:00Z') });
    expect(slots.every((s) => !s.available)).toBe(true);
  });
});

describe('pricing', () => {
  const items = [
    { id: 'a', code: 'AC-GEN', name: 'General service', basePriceMinor: 50000, visitChargeMinor: 10000, estimatedMinutes: 60, sortOrder: 2 },
    { id: 'b', code: 'AC-GAS-REFILL', name: 'Gas refill', basePriceMinor: 200000, visitChargeMinor: 0, estimatedMinutes: 90, sortOrder: 1 },
  ];
  it('matches the issue slug, else the first by sortOrder', () => {
    expect(pickCatalogItem(items, 'gas-refill')?.id).toBe('b');
    expect(pickCatalogItem(items, 'unknown')?.id).toBe('b');
    expect(pickCatalogItem([], 'x')).toBeNull();
  });
  it('prices from catalog with emergency surge', () => {
    expect(computeEstimate({ category: 'AC_REPAIR', issueId: 'ac-gen', catalog: items, isEmergency: true })).toEqual({
      estimateMinor: 84000,
      visitMinutes: 60,
      surgeMultiplier: 1.4,
      catalogItemId: 'a',
    });
  });
  it('falls back to defaults with an empty catalog', () => {
    const r = computeEstimate({ category: 'CEILING_FAN', catalog: [] });
    expect(r).toEqual({ estimateMinor: 19900, visitMinutes: 30, surgeMultiplier: 1, catalogItemId: null });
  });
});
