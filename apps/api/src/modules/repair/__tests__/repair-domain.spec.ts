import { isFieldTechnician } from '../domain/access';
import {
  duplicateItemKeys,
  findMissingRequiredItems,
  isAnswered,
  mergeChecklistEntries,
} from '../domain/checklist';
import { formatRepairNumber, nextSequence } from '../domain/numbering';
import {
  computeApplianceWarrantyStatus,
  computeRepairWarrantyUntil,
  planCoversCategory,
  snapshotIncludesAppliance,
} from '../domain/warranty';
import {
  allowedWorkshopTransitions,
  appendWorkshopHistory,
  canTransitionWorkshop,
  initialWorkshopStatus,
  workshopTimestampField,
} from '../domain/workshop-state';

const DAY = 24 * 60 * 60 * 1000;

describe('workshop state machine', () => {
  const chain = [
    'PICKUP_SCHEDULED',
    'PICKED_UP',
    'RECEIVED_AT_WORKSHOP',
    'DIAGNOSING',
    'AWAITING_APPROVAL',
    'REPAIRING',
    'READY_FOR_DELIVERY',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
  ] as const;

  it('allows every step of the happy path', () => {
    for (let i = 0; i < chain.length - 1; i++) {
      expect(canTransitionWorkshop(chain[i]!, chain[i + 1]!)).toBe(true);
    }
  });

  it('forbids skipping and going backwards', () => {
    expect(canTransitionWorkshop('PICKUP_SCHEDULED', 'RECEIVED_AT_WORKSHOP')).toBe(false);
    expect(canTransitionWorkshop('REPAIRING', 'DIAGNOSING')).toBe(false);
    expect(canTransitionWorkshop('PICKED_UP', 'PICKED_UP')).toBe(false);
  });

  it('allows CANCELLED from any non-terminal state only', () => {
    for (const s of chain.slice(0, -1)) expect(canTransitionWorkshop(s, 'CANCELLED')).toBe(true);
    expect(canTransitionWorkshop('DELIVERED', 'CANCELLED')).toBe(false);
    expect(canTransitionWorkshop('CANCELLED', 'PICKED_UP')).toBe(false);
  });

  it('lets carry-in jobs start at the workshop and be collected without delivery', () => {
    expect(initialWorkshopStatus('CARRY_IN')).toBe('RECEIVED_AT_WORKSHOP');
    expect(initialWorkshopStatus('PICKUP_DROP')).toBe('PICKUP_SCHEDULED');
    expect(canTransitionWorkshop('READY_FOR_DELIVERY', 'DELIVERED', 'CARRY_IN')).toBe(true);
    expect(canTransitionWorkshop('READY_FOR_DELIVERY', 'DELIVERED', 'PICKUP_DROP')).toBe(false);
  });

  it('lists allowed transitions and timestamp fields', () => {
    expect(allowedWorkshopTransitions('DIAGNOSING').sort()).toEqual(
      ['AWAITING_APPROVAL', 'CANCELLED', 'REPAIRING'].sort(),
    );
    expect(workshopTimestampField('PICKED_UP')).toBe('pickedUpAt');
    expect(workshopTimestampField('DELIVERED')).toBe('deliveredAt');
    expect(workshopTimestampField('DIAGNOSING')).toBeNull();
  });

  it('appends history without mutating the input', () => {
    const prev = [{ status: 'PICKUP_SCHEDULED', from: null, at: 'x', by: null, note: null }];
    const next = appendWorkshopHistory(prev, {
      status: 'PICKED_UP',
      from: 'PICKUP_SCHEDULED',
      at: 'y',
      by: 'u',
      note: null,
    });
    expect(next).toHaveLength(2);
    expect(prev).toHaveLength(1);
    expect(appendWorkshopHistory(null, next[1]!)).toHaveLength(1);
  });
});

describe('checklist helpers', () => {
  const tpl = {
    id: 't1',
    kind: 'POST_SERVICE',
    name: 'AC post',
    items: [
      { key: 'gasPsi', label: 'Gas pressure', type: 'number', required: true },
      { key: 'filterCleaned', label: 'Filter cleaned', type: 'bool', required: true },
      { key: 'photo', label: 'Photo', type: 'photo', required: false },
    ],
  };

  it('treats false as a valid bool answer but not empty strings / NaN', () => {
    expect(isAnswered('bool', false)).toBe(true);
    expect(isAnswered('bool', 'yes')).toBe(false);
    expect(isAnswered('number', 0)).toBe(true);
    expect(isAnswered('number', '')).toBe(false);
    expect(isAnswered('text', '  ')).toBe(false);
    expect(isAnswered('photo', ['https://x/y.jpg'])).toBe(true);
  });

  it('reports missing required items', () => {
    const missing = findMissingRequiredItems([tpl], [
      { templateId: 't1', kind: 'POST_SERVICE', answers: { gasPsi: 60 } },
    ]);
    expect(missing.map((m) => m.key)).toEqual(['filterCleaned']);
    expect(findMissingRequiredItems([tpl], [])).toHaveLength(2);
    expect(
      findMissingRequiredItems([tpl], [
        { templateId: 't1', kind: 'POST_SERVICE', answers: { gasPsi: 60, filterCleaned: false } },
      ]),
    ).toEqual([]);
  });

  it('merges entries per template with shallow-merged answers', () => {
    const merged = mergeChecklistEntries(
      [{ templateId: 't1', kind: 'POST_SERVICE', answers: { gasPsi: 60 } }],
      [
        { templateId: 't1', kind: 'POST_SERVICE', answers: { filterCleaned: true } },
        { templateId: 't2', kind: 'SAFETY', answers: { earthing: true } },
      ],
    );
    expect(merged).toEqual([
      { templateId: 't1', kind: 'POST_SERVICE', answers: { gasPsi: 60, filterCleaned: true } },
      { templateId: 't2', kind: 'SAFETY', answers: { earthing: true } },
    ]);
  });

  it('detects duplicate keys', () => {
    expect(duplicateItemKeys([{ key: 'a' }, { key: 'b' }, { key: 'a' }])).toEqual(['a']);
  });
});

describe('warranty helpers', () => {
  const completed = new Date('2026-10-01T00:00:00Z');

  it('defaults the repair window to 30 days', () => {
    expect(computeRepairWarrantyUntil(completed, null).getTime()).toBe(completed.getTime() + 30 * DAY);
    expect(computeRepairWarrantyUntil(completed, 90).getTime()).toBe(completed.getTime() + 90 * DAY);
    expect(computeRepairWarrantyUntil(completed, 0).getTime()).toBe(completed.getTime());
  });

  it('matches AC categories as one family for AMC coverage', () => {
    expect(planCoversCategory(['AC_SERVICING'], 'AC_REPAIR')).toBe(true);
    expect(planCoversCategory(['AC_SERVICING'], 'REFRIGERATOR')).toBe(false);
    expect(snapshotIncludesAppliance([{ applianceId: 'a1' }], 'a1')).toBe(true);
    expect(snapshotIncludesAppliance(['a2'], 'a1')).toBe(false);
  });

  it('computes appliance warranty windows', () => {
    const now = new Date('2026-10-16T00:00:00Z');
    const status = computeApplianceWarrantyStatus({
      manufacturerWarrantyUntil: new Date('2027-01-01T00:00:00Z'),
      extendedWarrantyUntil: new Date('2026-01-01T00:00:00Z'),
      latestRepair: { bookingId: 'b1', repairWarrantyUntil: new Date('2026-10-20T00:00:00Z') },
      amcCovered: true,
      now,
    });
    expect(status.manufacturer.active).toBe(true);
    expect(status.extended.active).toBe(false);
    expect(status.repair).toEqual({
      active: true,
      until: new Date('2026-10-20T00:00:00Z'),
      bookingId: 'b1',
    });
    expect(status.amcCovered).toBe(true);
  });
});

describe('repair numbering', () => {
  it('formats and increments numbers', () => {
    expect(formatRepairNumber('WC', 2026, 123)).toBe('WC-2026-000123');
    expect(nextSequence(null, 'WC-2026-')).toBe(1);
    expect(nextSequence('WC-2026-000041', 'WC-2026-')).toBe(42);
    expect(nextSequence('WC-2025-000041', 'WC-2026-')).toBe(1);
  });
});

describe('isFieldTechnician', () => {
  it('is true only for technicians without a staff role', () => {
    expect(isFieldTechnician({ roles: ['TECHNICIAN'] as never })).toBe(true);
    expect(isFieldTechnician({ roles: ['TECHNICIAN', 'ADMIN'] as never })).toBe(false);
    expect(isFieldTechnician({ roles: ['DISPATCHER'] as never })).toBe(false);
  });
});
