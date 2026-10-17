import type { ServiceCategory } from '@ac/types';

import { apiFetch, type PaginatedResponse } from './client';

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

export type ServiceMode = 'ON_SITE' | 'PICKUP_DROP' | 'CARRY_IN';
export type ChecklistKind = 'PRE_SERVICE' | 'POST_SERVICE' | 'SAFETY';
export type ChecklistItemType = 'bool' | 'number' | 'text' | 'photo';
export type JobCardStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';
export type WarrantyClaimType = 'REPAIR_REVISIT' | 'OEM_CLAIM';
export type WarrantyClaimStatus =
  | 'OPEN'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUBMITTED_TO_OEM'
  | 'SETTLED'
  | 'CLOSED';
export type WorkshopStatus =
  | 'PICKUP_SCHEDULED'
  | 'PICKED_UP'
  | 'RECEIVED_AT_WORKSHOP'
  | 'DIAGNOSING'
  | 'AWAITING_APPROVAL'
  | 'REPAIRING'
  | 'READY_FOR_DELIVERY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export const WORKSHOP_STATUSES: WorkshopStatus[] = [
  'PICKUP_SCHEDULED',
  'PICKED_UP',
  'RECEIVED_AT_WORKSHOP',
  'DIAGNOSING',
  'AWAITING_APPROVAL',
  'REPAIRING',
  'READY_FOR_DELIVERY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
];

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  'AC_REPAIR',
  'AC_SERVICING',
  'AC_INSTALLATION',
  'REFRIGERATOR',
  'WASHING_MACHINE',
  'MICROWAVE',
  'OVEN',
  'GEYSER',
  'CHIMNEY',
  'TELEVISION',
  'WATER_PURIFIER',
  'DISHWASHER',
  'AIR_COOLER',
  'INVERTER_UPS',
  'CEILING_FAN',
  'VACUUM_CLEANER',
  'ELECTRICAL_WIRING',
  'OTHER',
] as ServiceCategory[];

export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  return value
    .toLowerCase()
    .split('_')
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Appliances
// ---------------------------------------------------------------------------

export interface Appliance {
  id: string;
  customerId: string;
  addressId: string | null;
  category: ServiceCategory;
  brand: string;
  modelNumber: string | null;
  serialNumber: string | null;
  capacity: string | null;
  installedLocation: string | null;
  purchaseDate: string | null;
  installDate: string | null;
  manufacturerWarrantyUntil: string | null;
  extendedWarrantyUntil: string | null;
  warrantyProvider: string | null;
  purchaseInvoiceUrl: string | null;
  photos: string[];
  notes: string | null;
  lastServicedAt: string | null;
  createdAt: string;
  customer?: { id: string; fullName: string; phone: string };
  address?: { id: string; line1: string; line2: string | null; city: string; pincode: string } | null;
  _count?: { bookings: number; jobCards: number; warrantyClaims: number };
}

export interface ApplianceInput {
  customerId?: string;
  addressId?: string | null;
  category?: ServiceCategory;
  brand?: string;
  modelNumber?: string | null;
  serialNumber?: string | null;
  capacity?: string | null;
  installedLocation?: string | null;
  purchaseDate?: string | null;
  installDate?: string | null;
  manufacturerWarrantyUntil?: string | null;
  extendedWarrantyUntil?: string | null;
  warrantyProvider?: string | null;
  notes?: string | null;
}

export interface ApplianceListQuery {
  page?: number;
  pageSize?: number;
  customerId?: string;
  category?: ServiceCategory;
  serial?: string;
  q?: string;
}

export interface ApplianceHistory {
  bookings: {
    id: string;
    code: string;
    status: string;
    category: string;
    serviceType: string | null;
    serviceMode: ServiceMode;
    scheduledAt: string;
    completedAt: string | null;
    isWarrantyRevisit: boolean;
    repairWarrantyUntil: string | null;
    technician: { id: string; fullName: string } | null;
  }[];
  jobCards: {
    id: string;
    bookingId: string;
    status: JobCardStatus;
    diagnosis: string | null;
    resolution: string | null;
    faultCodes: string[];
    completedAt: string | null;
    booking: { code: string };
  }[];
  warrantyClaims: {
    id: string;
    number: string;
    type: WarrantyClaimType;
    status: WarrantyClaimStatus;
    reason: string;
    createdAt: string;
  }[];
  timeline: {
    type: 'booking' | 'jobCard' | 'warrantyClaim';
    id: string;
    at: string;
    title: string;
    status: string;
    bookingId: string | null;
  }[];
}

export interface WarrantyWindow {
  active: boolean;
  until: string | null;
}

export interface ApplianceWarrantyStatus {
  manufacturer: WarrantyWindow;
  extended: WarrantyWindow;
  repair: WarrantyWindow & { bookingId: string | null };
  amcCovered: boolean;
}

// ---------------------------------------------------------------------------
// Catalog / fault codes / checklists
// ---------------------------------------------------------------------------

export interface CatalogItem {
  id: string;
  code: string;
  category: ServiceCategory;
  name: string;
  description: string | null;
  basePriceMinor: number;
  visitChargeMinor: number;
  estimatedMinutes: number;
  repairWarrantyDays: number;
  gstRateBps: number;
  sacCode: string | null;
  isActive: boolean;
  sortOrder: number;
}
export type CatalogItemInput = Partial<Omit<CatalogItem, 'id'>>;

export interface FaultCode {
  id: string;
  category: ServiceCategory;
  brand: string | null;
  code: string;
  title: string;
  description: string | null;
  suggestedFix: string | null;
  isActive: boolean;
}
export type FaultCodeInput = Partial<Omit<FaultCode, 'id'>>;

export interface ChecklistItem {
  key: string;
  label: string;
  type: ChecklistItemType;
  unit?: string;
  required: boolean;
}

export interface ChecklistTemplate {
  id: string;
  category: ServiceCategory;
  kind: ChecklistKind;
  name: string;
  items: ChecklistItem[];
  version: number;
  isActive: boolean;
}
export type ChecklistTemplateInput = Partial<Omit<ChecklistTemplate, 'id' | 'version'>>;

// ---------------------------------------------------------------------------
// Job cards
// ---------------------------------------------------------------------------

export interface ChecklistEntry {
  templateId: string;
  kind: ChecklistKind;
  answers: Record<string, unknown>;
}

export interface JobCardBookingSummary {
  id: string;
  code: string;
  status: string;
  category: ServiceCategory;
  scheduledAt: string;
  technicianId: string | null;
  applianceId: string | null;
  customer: { id: string; fullName: string; phone: string };
  appliance: { id: string; brand: string; modelNumber: string | null; category: string } | null;
}

export interface JobCard {
  id: string;
  bookingId: string;
  technicianId: string | null;
  applianceId: string | null;
  status: JobCardStatus;
  symptoms: string[];
  faultCodes: string[];
  diagnosis: string | null;
  rootCause: string | null;
  resolution: string | null;
  readings: Record<string, unknown>;
  checklist: ChecklistEntry[];
  partsRecommended: Record<string, unknown>[];
  photos: string[];
  firstTimeFix: boolean | null;
  technicianRemarks: string | null;
  customerRemarks: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  booking?: JobCardBookingSummary;
  technician?: { id: string; fullName: string; phone: string } | null;
}

export interface JobCardListQuery {
  page?: number;
  pageSize?: number;
  status?: JobCardStatus;
  technicianId?: string;
  from?: string;
  to?: string;
  search?: string;
}

// ---------------------------------------------------------------------------
// Warranty
// ---------------------------------------------------------------------------

export interface WarrantyClaim {
  id: string;
  number: string;
  type: WarrantyClaimType;
  status: WarrantyClaimStatus;
  customerId: string;
  applianceId: string | null;
  originalBookingId: string | null;
  revisitBookingId: string | null;
  reason: string;
  description: string | null;
  oemName: string | null;
  oemClaimRef: string | null;
  claimAmountMinor: number;
  settledAmountMinor: number;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionNotes: string | null;
  createdAt: string;
  customer?: { id: string; fullName: string; phone: string };
  appliance?: {
    id: string;
    category: string;
    brand: string;
    modelNumber: string | null;
    serialNumber: string | null;
  } | null;
  originalBooking?: {
    id: string;
    code: string;
    status: string;
    completedAt: string | null;
    repairWarrantyUntil: string | null;
  } | null;
  revisitBooking?: { id: string; code: string; status: string; scheduledAt: string } | null;
}

export interface WarrantyCheck {
  eligibleForRepairRevisit: boolean;
  repairWarrantyUntil: string | null;
  originalBookingId: string | null;
  originalBookingCode: string | null;
  applianceId: string | null;
  manufacturerWarrantyActive: boolean;
  manufacturerWarrantyUntil: string | null;
  extendedWarrantyActive: boolean;
  extendedWarrantyUntil: string | null;
  amcCovered: boolean;
  existingClaimId: string | null;
  reason: string | null;
}

export interface CreateWarrantyClaimInput {
  type: WarrantyClaimType;
  customerId: string;
  applianceId?: string;
  originalBookingId?: string;
  reason: string;
  description?: string;
  oemName?: string;
  claimAmountMinor?: number;
}

// ---------------------------------------------------------------------------
// Workshop
// ---------------------------------------------------------------------------

export interface WorkshopHistoryEntry {
  status: WorkshopStatus;
  from: WorkshopStatus | null;
  at: string;
  by: string | null;
  note: string | null;
}

export interface WorkshopJob {
  id: string;
  number: string;
  bookingId: string;
  warehouseId: string | null;
  status: WorkshopStatus;
  pickupScheduledAt: string | null;
  pickedUpAt: string | null;
  receivedAt: string | null;
  estimatedReadyAt: string | null;
  readyAt: string | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  conditionOnReceipt: string | null;
  accessoriesReceived: string[];
  photos: string[];
  notes: string | null;
  history: WorkshopHistoryEntry[];
  updatedAt: string;
  allowedTransitions: WorkshopStatus[];
  booking: {
    id: string;
    code: string;
    status: string;
    category: string;
    serviceMode: ServiceMode;
    scheduledAt: string;
    customer: { id: string; fullName: string; phone: string };
    appliance: { id: string; category: string; brand: string; modelNumber: string | null } | null;
  };
}

export interface WorkshopTransitionInput {
  status: WorkshopStatus;
  note?: string;
  conditionOnReceipt?: string;
  accessoriesReceived?: string[];
  photos?: string[];
}

// ---------------------------------------------------------------------------
// Booking repair fields (detail view additions)
// ---------------------------------------------------------------------------

export interface BookingRepairInfo {
  id: string;
  customerId: string;
  category: ServiceCategory;
  status: string;
  applianceId: string | null;
  catalogItemId: string | null;
  serviceMode: ServiceMode;
  isWarrantyRevisit: boolean;
  parentBookingId: string | null;
  repairWarrantyUntil: string | null;
  appliance: (Partial<Appliance> & { id: string; brand: string }) | null;
  catalogItem: {
    id: string;
    code: string;
    name: string;
    basePriceMinor: number;
    visitChargeMinor: number;
    repairWarrantyDays: number;
  } | null;
  jobCard: Pick<
    JobCard,
    'id' | 'status' | 'symptoms' | 'faultCodes' | 'diagnosis' | 'resolution' | 'firstTimeFix' | 'startedAt' | 'completedAt'
  > | null;
  workshopJob: Pick<
    WorkshopJob,
    'id' | 'number' | 'status' | 'pickupScheduledAt' | 'receivedAt' | 'estimatedReadyAt'
  > & { deliveredAt: string | null } | null;
  rating: { id: string; value: number; npsScore: number | null; comment: string | null } | null;
  parentBooking: { id: string; code: string } | null;
  warrantyClaimRevisit: { id: string; number: string; status: WarrantyClaimStatus } | null;
  warrantyClaimsOriginal: {
    id: string;
    number: string;
    type: WarrantyClaimType;
    status: WarrantyClaimStatus;
  }[];
  warranty?: {
    repairWarrantyUntil: string | null;
    repairWarrantyActive: boolean;
    manufacturerWarrantyActive: boolean;
    extendedWarrantyActive: boolean;
  };
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

const BASE = '/repair';

export const repairApi = {
  // Appliances
  listAppliances: (query: ApplianceListQuery) =>
    apiFetch<PaginatedResponse<Appliance>>(`${BASE}/appliances`, {
      query: query as Record<string, unknown>,
    }),
  getAppliance: (id: string) => apiFetch<Appliance>(`${BASE}/appliances/${id}`),
  createAppliance: (body: ApplianceInput) =>
    apiFetch<Appliance>(`${BASE}/appliances`, { method: 'POST', body }),
  updateAppliance: (id: string, body: ApplianceInput) =>
    apiFetch<Appliance>(`${BASE}/appliances/${id}`, { method: 'PATCH', body }),
  deleteAppliance: (id: string) =>
    apiFetch<{ id: string }>(`${BASE}/appliances/${id}`, { method: 'DELETE' }),
  applianceHistory: (id: string) => apiFetch<ApplianceHistory>(`${BASE}/appliances/${id}/history`),
  applianceWarranty: (id: string) =>
    apiFetch<ApplianceWarrantyStatus>(`${BASE}/appliances/${id}/warranty-status`),

  // Catalog
  listCatalog: (query: { category?: ServiceCategory; active?: boolean } = {}) =>
    apiFetch<CatalogItem[]>(`${BASE}/catalog`, { query: query }),
  createCatalogItem: (body: CatalogItemInput) =>
    apiFetch<CatalogItem>(`${BASE}/catalog`, { method: 'POST', body }),
  updateCatalogItem: (id: string, body: CatalogItemInput) =>
    apiFetch<CatalogItem>(`${BASE}/catalog/${id}`, { method: 'PATCH', body }),
  deleteCatalogItem: (id: string) =>
    apiFetch<{ id: string }>(`${BASE}/catalog/${id}`, { method: 'DELETE' }),

  // Fault codes
  listFaultCodes: (query: { category?: ServiceCategory; brand?: string; q?: string } = {}) =>
    apiFetch<FaultCode[]>(`${BASE}/fault-codes`, { query: query }),
  createFaultCode: (body: FaultCodeInput) =>
    apiFetch<FaultCode>(`${BASE}/fault-codes`, { method: 'POST', body }),
  updateFaultCode: (id: string, body: FaultCodeInput) =>
    apiFetch<FaultCode>(`${BASE}/fault-codes/${id}`, { method: 'PATCH', body }),
  deleteFaultCode: (id: string) =>
    apiFetch<{ id: string }>(`${BASE}/fault-codes/${id}`, { method: 'DELETE' }),

  // Checklists
  listChecklists: (query: { category?: ServiceCategory; kind?: ChecklistKind } = {}) =>
    apiFetch<ChecklistTemplate[]>(`${BASE}/checklists`, { query: query }),
  createChecklist: (body: ChecklistTemplateInput) =>
    apiFetch<ChecklistTemplate>(`${BASE}/checklists`, { method: 'POST', body }),
  updateChecklist: (id: string, body: ChecklistTemplateInput) =>
    apiFetch<ChecklistTemplate>(`${BASE}/checklists/${id}`, { method: 'PATCH', body }),
  deleteChecklist: (id: string) =>
    apiFetch<{ id: string }>(`${BASE}/checklists/${id}`, { method: 'DELETE' }),

  // Job cards
  listJobCards: (query: JobCardListQuery) =>
    apiFetch<PaginatedResponse<JobCard>>(`${BASE}/job-cards`, {
      query: query as Record<string, unknown>,
    }),
  getJobCard: (id: string) =>
    apiFetch<JobCard & { templates: ChecklistTemplate[] }>(`${BASE}/job-cards/${id}`),
  getJobCardByBooking: (bookingId: string) =>
    apiFetch<{
      jobCard: JobCard | null;
      templates: ChecklistTemplate[];
      booking: JobCardBookingSummary;
    }>(`${BASE}/job-cards/by-booking/${bookingId}`),

  // Warranty
  checkWarranty: (query: { bookingId?: string; applianceId?: string }) =>
    apiFetch<WarrantyCheck>(`${BASE}/warranty/check`, { query: query }),
  listClaims: (query: {
    page?: number;
    pageSize?: number;
    status?: WarrantyClaimStatus;
    type?: WarrantyClaimType;
    search?: string;
    customerId?: string;
  }) =>
    apiFetch<PaginatedResponse<WarrantyClaim>>(`${BASE}/warranty-claims`, {
      query: query,
    }),
  getClaim: (id: string) => apiFetch<WarrantyClaim>(`${BASE}/warranty-claims/${id}`),
  createClaim: (body: CreateWarrantyClaimInput) =>
    apiFetch<WarrantyClaim>(`${BASE}/warranty-claims`, { method: 'POST', body }),
  decideClaim: (id: string, body: { approve: boolean; notes?: string }) =>
    apiFetch<WarrantyClaim>(`${BASE}/warranty-claims/${id}/decide`, { method: 'POST', body }),
  scheduleRevisit: (id: string, body: { scheduledAt: string; scheduledTimeSlot?: string; notes?: string }) =>
    apiFetch<WarrantyClaim>(`${BASE}/warranty-claims/${id}/revisit`, { method: 'POST', body }),
  updateOem: (
    id: string,
    body: { status: 'SUBMITTED_TO_OEM' | 'SETTLED'; oemClaimRef?: string; settledAmountMinor?: number },
  ) => apiFetch<WarrantyClaim>(`${BASE}/warranty-claims/${id}/oem`, { method: 'POST', body }),

  // Workshop
  listWorkshopJobs: (query: { page?: number; pageSize?: number; status?: WorkshopStatus[]; search?: string }) =>
    apiFetch<PaginatedResponse<WorkshopJob>>(`${BASE}/workshop-jobs`, {
      query: query,
    }),
  getWorkshopJob: (id: string) => apiFetch<WorkshopJob>(`${BASE}/workshop-jobs/${id}`),
  createWorkshopJob: (body: {
    bookingId: string;
    warehouseId?: string;
    pickupScheduledAt?: string;
    estimatedReadyAt?: string;
  }) => apiFetch<WorkshopJob>(`${BASE}/workshop-jobs`, { method: 'POST', body }),
  transitionWorkshopJob: (id: string, body: WorkshopTransitionInput) =>
    apiFetch<WorkshopJob>(`${BASE}/workshop-jobs/${id}/transition`, { method: 'POST', body }),

  // Booking repair fields (PATCH /bookings/:id accepts applianceId / catalogItemId / serviceMode)
  updateBookingRepairFields: (
    bookingId: string,
    body: { applianceId?: string | null; catalogItemId?: string | null; serviceMode?: ServiceMode },
  ) => apiFetch<unknown>(`/bookings/${bookingId}`, { method: 'PATCH', body }),
};
