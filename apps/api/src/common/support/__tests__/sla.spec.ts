import { TicketPriority, TicketStatus } from '@ac/types';

import {
  addBusinessMinutes,
  addMinutes,
  computeDueDates,
  isOverdue,
  isSlaActive,
  minutesUntil,
  warningWindowMinutes,
  type SlaProfileSnapshot,
} from '../sla';

const baseProfile = (overrides: Partial<SlaProfileSnapshot> = {}): SlaProfileSnapshot => ({
  firstResponseMinutes: 30,
  resolutionMinutes: 240,
  businessHoursOnly: false,
  priorityOverrides: {
    [TicketPriority.LOW]: undefined,
    [TicketPriority.NORMAL]: undefined,
    [TicketPriority.HIGH]: undefined,
    [TicketPriority.URGENT]: undefined,
  },
  ...overrides,
});

describe('common/support/sla', () => {
  describe('addMinutes', () => {
    it('adds whole minutes precisely', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      expect(addMinutes(start, 90).toISOString()).toBe('2025-01-01T01:30:00.000Z');
    });
  });

  describe('addBusinessMinutes', () => {
    it('does not advance past 18:00 — wraps to next business day', () => {
      // Wed 17:30 UTC + 90 mins → 09:30 next day (Thu).
      const start = new Date('2025-01-01T17:30:00Z'); // Wednesday
      const out = addBusinessMinutes(start, 90);
      expect(out.getUTCDay()).toBe(4); // Thursday
      expect(out.getUTCHours()).toBe(10);
      expect(out.getUTCMinutes()).toBe(0);
    });

    it('skips Sunday entirely', () => {
      // Saturday 17:30 + 60 mins → Monday 09:30 (skipping Sunday).
      const start = new Date('2025-01-04T17:30:00Z'); // Saturday
      const out = addBusinessMinutes(start, 60);
      expect(out.getUTCDay()).toBe(1); // Monday
    });
  });

  describe('computeDueDates', () => {
    it('uses base profile when there is no priority override', () => {
      const created = new Date('2025-01-01T00:00:00Z');
      const { firstResponseDueAt, resolutionDueAt } = computeDueDates(
        created,
        TicketPriority.NORMAL,
        baseProfile(),
      );
      expect(firstResponseDueAt.toISOString()).toBe('2025-01-01T00:30:00.000Z');
      expect(resolutionDueAt.toISOString()).toBe('2025-01-01T04:00:00.000Z');
    });

    it('honours priority overrides', () => {
      const created = new Date('2025-01-01T00:00:00Z');
      const profile = baseProfile({
        priorityOverrides: {
          [TicketPriority.LOW]: undefined,
          [TicketPriority.NORMAL]: undefined,
          [TicketPriority.HIGH]: undefined,
          [TicketPriority.URGENT]: { firstResponseMinutes: 5, resolutionMinutes: 60 },
        },
      });
      const out = computeDueDates(created, TicketPriority.URGENT, profile);
      expect(minutesUntil(out.firstResponseDueAt, created)).toBe(5);
      expect(minutesUntil(out.resolutionDueAt, created)).toBe(60);
    });
  });

  describe('isOverdue', () => {
    it('returns false for null / undefined', () => {
      expect(isOverdue(null)).toBe(false);
      expect(isOverdue(undefined)).toBe(false);
    });
    it('returns true when target is in the past', () => {
      expect(isOverdue(new Date('2020-01-01T00:00:00Z'), new Date())).toBe(true);
    });
    it('returns false when target is in the future', () => {
      const future = new Date(Date.now() + 60_000);
      expect(isOverdue(future)).toBe(false);
    });
  });

  describe('isSlaActive', () => {
    it('returns true for OPEN tickets', () => {
      expect(isSlaActive(TicketStatus.OPEN)).toBe(true);
    });
    it('returns false for RESOLVED tickets', () => {
      expect(isSlaActive(TicketStatus.RESOLVED)).toBe(false);
    });
    it('returns false for CLOSED tickets', () => {
      expect(isSlaActive(TicketStatus.CLOSED)).toBe(false);
    });
  });

  describe('warningWindowMinutes', () => {
    it('caps at 60', () => {
      expect(warningWindowMinutes(10_000)).toBe(60);
    });
    it('returns at least 5', () => {
      expect(warningWindowMinutes(1)).toBe(5);
    });
    it('returns ~15% of total', () => {
      expect(warningWindowMinutes(200)).toBe(30);
    });
  });
});
