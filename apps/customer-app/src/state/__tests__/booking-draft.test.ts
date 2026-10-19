import { STEP_ORDER, toCreateBookingInput, useBookingDraft } from '../booking-draft';

describe('booking draft store', () => {
  beforeEach(() => useBookingDraft.getState().reset());

  it('initialises at the service step', () => {
    expect(useBookingDraft.getState().step).toBe('service');
  });

  it('advances through STEP_ORDER on next()', () => {
    for (let i = 0; i < STEP_ORDER.length - 1; i += 1) {
      const before = useBookingDraft.getState().step;
      useBookingDraft.getState().next();
      const after = useBookingDraft.getState().step;
      expect(STEP_ORDER.indexOf(after)).toBe(STEP_ORDER.indexOf(before) + 1);
    }
    // Last step is sticky.
    useBookingDraft.getState().next();
    expect(useBookingDraft.getState().step).toBe('review');
  });

  it('back() walks toward service and stops there', () => {
    useBookingDraft.getState().setStep('review');
    for (const _step of STEP_ORDER) {
      useBookingDraft.getState().back();
    }
    expect(useBookingDraft.getState().step).toBe('service');
  });

  it('patches discrete fields', () => {
    useBookingDraft.getState().patch({ applianceId: 'ac', isEmergency: true });
    expect(useBookingDraft.getState().applianceId).toBe('ac');
    expect(useBookingDraft.getState().isEmergency).toBe(true);
  });

  it('reset returns to initial state', () => {
    useBookingDraft.getState().patch({ applianceId: 'ac', issueId: 'no-cooling' });
    useBookingDraft.getState().reset();
    expect(useBookingDraft.getState().applianceId).toBeNull();
    expect(useBookingDraft.getState().issueId).toBeNull();
    expect(useBookingDraft.getState().step).toBe('service');
  });

  it('builds the create payload with server categories, appliance and coupon', () => {
    const d = useBookingDraft.getState();
    expect(toCreateBookingInput(d)).toBeNull();
    d.patch({
      applianceId: 'washing-machine',
      issueId: 'not-spinning',
      scheduledAt: '2030-01-01T02:30:00.000Z',
      slotEnd: '2030-01-01T05:30:00.000Z',
      address: { id: 'a1', label: 'HOME', line1: 'L1', city: 'Pune', pincode: '411001', isDefault: true },
      customerApplianceId: 'ap1',
      couponCode: 'SAVE10',
    });
    expect(toCreateBookingInput(useBookingDraft.getState())).toMatchObject({
      applianceCategory: 'WASHING_MACHINE',
      issueId: 'not-spinning',
      issueLabel: 'Not spinning',
      addressId: 'a1',
      applianceId: 'ap1',
      couponCode: 'SAVE10',
      slotEnd: '2030-01-01T05:30:00.000Z',
    });
  });
});
