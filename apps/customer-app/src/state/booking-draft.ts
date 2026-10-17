import { create } from 'zustand';

import type { CreateBookingInput, CustomerAddress } from '@/api/types';
import { getAppliance } from '@/content/appliances';

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
  /** Catalogue entry id from `content/appliances` (e.g. "ac"). */
  applianceId: string | null;
  /** Optional registered appliance (`/v1/me/appliances`) the job is for. */
  customerApplianceId: string | null;
  issueId: string | null;
  notes: string;
  photos: string[];
  scheduledAt: string | null;
  slotEnd: string | null;
  slotLabel: string | null;
  isEmergency: boolean;
  address: CustomerAddress | null;
  contactPhone: string | null;
  /** Coupon validated via `/v1/me/coupons/validate`; stored on the booking. */
  couponCode: string | null;
  couponDiscountMinor: number;
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
  customerApplianceId: null,
  issueId: null,
  notes: '',
  photos: [],
  scheduledAt: null,
  slotEnd: null,
  slotLabel: null,
  isEmergency: false,
  address: null,
  contactPhone: null,
  couponCode: null,
  couponDiscountMinor: 0,
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

/**
 * Draft → `POST /v1/me/bookings` body. Returns null while required fields are
 * missing so the review step can keep the CTA disabled.
 */
export function toCreateBookingInput(draft: BookingDraft): CreateBookingInput | null {
  const appliance = draft.applianceId ? getAppliance(draft.applianceId) : undefined;
  if (!appliance || !draft.scheduledAt || !draft.address) return null;
  const issue = appliance.issues.find((i) => i.id === draft.issueId);
  return {
    applianceCategory: appliance.category,
    issueId: draft.issueId ?? undefined,
    issueLabel: issue?.label,
    notes: draft.notes.trim() || undefined,
    photoUrls: draft.photos.length ? draft.photos : undefined,
    scheduledAt: draft.scheduledAt,
    slotEnd: draft.slotEnd ?? undefined,
    slotLabel: draft.slotLabel ?? undefined,
    isEmergency: draft.isEmergency || undefined,
    addressId: draft.address.id,
    contactPhone: draft.contactPhone ?? undefined,
    applianceId: draft.customerApplianceId ?? undefined,
    couponCode: draft.couponCode ?? undefined,
  };
}
