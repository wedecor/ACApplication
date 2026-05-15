import { create } from 'zustand';

import type { CustomerAddress } from '@/api/types';

/**
 * Booking draft state.
 *
 * Lives in-memory only \u2014 the booking flow is short, single-session and
 * we don\u2019t want stale drafts persisting across days. If the user kills
 * the app mid-flow they restart from the first step (intentional, this
 * is how Urban Company / Swiggy behave too).
 */
export type BookingStep = 'service' | 'issue' | 'photos' | 'schedule' | 'address' | 'review';

export const STEP_ORDER: BookingStep[] = [
  'service',
  'issue',
  'photos',
  'schedule',
  'address',
  'review',
];

export interface BookingDraft {
  step: BookingStep;
  applianceId: string | null;
  issueId: string | null;
  notes: string;
  photos: string[];
  scheduledAt: string | null;
  slotLabel: string | null;
  isEmergency: boolean;
  address: CustomerAddress | null;
  contactPhone: string | null;
}

interface DraftActions {
  reset: () => void;
  setStep: (step: BookingStep) => void;
  next: () => void;
  back: () => void;
  patch: (patch: Partial<BookingDraft>) => void;
}

const initial: BookingDraft = {
  step: 'service',
  applianceId: null,
  issueId: null,
  notes: '',
  photos: [],
  scheduledAt: null,
  slotLabel: null,
  isEmergency: false,
  address: null,
  contactPhone: null,
};

export const useBookingDraft = create<BookingDraft & DraftActions>((set, get) => ({
  ...initial,
  reset: () => set({ ...initial }),
  setStep: (step) => set({ step }),
  patch: (patch) => set((s) => ({ ...s, ...patch })),
  next: () => {
    const idx = STEP_ORDER.indexOf(get().step);
    if (idx < STEP_ORDER.length - 1) set({ step: STEP_ORDER[idx + 1] });
  },
  back: () => {
    const idx = STEP_ORDER.indexOf(get().step);
    if (idx > 0) set({ step: STEP_ORDER[idx - 1] });
  },
}));
