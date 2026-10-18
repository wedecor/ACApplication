/**
 * Wire types for the repair endpoints (`/v1/repair/*`) and the extra booking
 * fields the job screen relies on. Kept dependency-free so pure helpers and
 * tests can import them without pulling in expo / react-native.
 *
 * Contract source: the repair module being built in apps/api/src/modules/repair.
 * If the server shape drifts, adjust it here + in `repair-api.ts` only.
 */

export type JobCardStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';
export type ChecklistKind = 'PRE_SERVICE' | 'POST_SERVICE' | 'SAFETY';
export type ChecklistItemType = 'bool' | 'number' | 'text' | 'photo';

export interface ChecklistTemplateItem {
  key: string;
  label: string;
  type: ChecklistItemType;
  unit?: string;
  required: boolean;
}

export interface ChecklistTemplate {
  id: string;
  kind: ChecklistKind;
  name: string;
  items: ChecklistTemplateItem[];
}

export interface ChecklistEntry {
  templateId: string;
  kind: ChecklistKind;
  answers: Record<string, unknown>;
}

export interface RecommendedPart {
  itemId?: string;
  sku?: string;
  name: string;
  quantity: number;
  /** True when the part is already on the technician's van. */
  inVan?: boolean;
}

export interface JobCard {
  id: string;
  status: JobCardStatus;
  symptoms: string[];
  faultCodes: string[];
  diagnosis: string | null;
  rootCause: string | null;
  resolution: string | null;
  readings: Record<string, number | string>;
  checklist: ChecklistEntry[];
  partsRecommended: unknown[];
  photos: string[];
  firstTimeFix: boolean | null;
  technicianRemarks: string | null;
  customerRemarks: string | null;
}

export type JobCardPatch = Partial<Omit<JobCard, 'id' | 'status'>>;

export interface JobCardResponse {
  jobCard: JobCard | null;
  templates: ChecklistTemplate[];
  /** Booking summary echoed by the API (not relied on by the app). */
  booking?: Record<string, unknown> | null;
}

export interface FaultCode {
  id: string;
  category: string;
  brand: string | null;
  code: string;
  title: string;
  suggestedFix: string | null;
}

export interface CatalogItem {
  id: string;
  code: string;
  category: string;
  name: string;
  basePriceMinor: number;
  visitChargeMinor: number;
  estimatedMinutes: number | null;
  repairWarrantyDays: number | null;
  gstRateBps: number;
}

export interface WarrantyWindow {
  active: boolean;
  until: string | null;
}

export interface WarrantyStatus {
  manufacturer: WarrantyWindow;
  extended: WarrantyWindow;
  repair: WarrantyWindow & { bookingId: string | null };
  amcCovered: boolean;
}

/** Loose — the history endpoint is still being built; we render defensively. */
export interface ApplianceHistoryEntry {
  id: string;
  code?: string | null;
  status?: string | null;
  scheduledAt?: string | null;
  completedAt?: string | null;
  serviceType?: string | null;
  category?: string | null;
  issueDescription?: string | null;
  resolution?: string | null;
  isWarrantyRevisit?: boolean | null;
  technician?: { fullName?: string | null } | null;
}

export interface ApplianceSummary {
  id: string;
  category: string;
  brand: string;
  modelNumber: string | null;
  serialNumber: string | null;
  capacity: string | null;
  installedLocation: string | null;
  purchaseDate: string | null;
  installDate: string | null;
  manufacturerWarrantyUntil: string | null;
  extendedWarrantyUntil: string | null;
  lastServicedAt: string | null;
}

export interface PresignResponse {
  uploadUrl: string;
  publicUrl: string;
  /** Optional — some storage backends echo the object key. */
  key?: string;
  storageKey?: string;
  headers?: Record<string, string>;
}

// ------------------------------------------------------------ field billing
// GET/POST /v1/repair/field-billing/:bookingId — technician-scoped billing.

export type FieldPaymentMethod = 'CASH' | 'UPI' | 'CARD';

export interface FieldBillingInvoice {
  id: string;
  number: string;
  status: string;
  totalMinor: number;
  amountPaidMinor: number;
  dueAmountMinor: number;
  currency: string;
}

export interface FieldBillingQuotation {
  id: string;
  number: string;
  status: string;
  totalMinor: number;
  viewToken?: string;
  /** Customer approval page on the website, built by the API from WEB_URL. */
  approvalUrl?: string;
}

export interface FieldBillingPayment {
  id: string;
  amountMinor: number;
  method: string;
  status: string;
  createdAt: string;
}

export interface FieldPaymentLink {
  id: string;
  url: string;
  status: string;
}

export interface FieldBillingSummary {
  invoice: FieldBillingInvoice | null;
  quotation: FieldBillingQuotation | null;
  payments: FieldBillingPayment[];
  paymentLink: FieldPaymentLink | null;
}
