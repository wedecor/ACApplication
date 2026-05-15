import { STEP_ORDER, useBookingDraft } from '../booking-draft';

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
    for (let i = 0; i < STEP_ORDER.length; i += 1) {
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
});
