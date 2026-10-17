/**
 * Typed client for the repair module (`/v1/repair/*`) and direct uploads
 * (`/v1/uploads/presign`). Every repair call lives here so the contract is
 * easy to adjust while the API side is still landing.
 *
 * 404 handling: the read helpers resolve to `null` (feature not deployed /
 * record missing) instead of throwing, so screens can render a friendly
 * "not available yet" state. Writes still throw — the offline queue keeps
 * 404'd writes and retries them later (see `write-queue-core.ts`).
 */
import { api, isNotFound } from './api';
import type {
  ApplianceHistoryEntry,
  CatalogItem,
  FaultCode,
  FieldBillingQuotation,
  FieldBillingSummary,
  FieldPaymentLink,
  FieldPaymentMethod,
  JobCard,
  JobCardPatch,
  JobCardResponse,
  PresignResponse,
  WarrantyStatus,
} from './repair-types';

export type {
  ApplianceHistoryEntry,
  ApplianceSummary,
  CatalogItem,
  ChecklistEntry,
  ChecklistItemType,
  ChecklistKind,
  ChecklistTemplate,
  ChecklistTemplateItem,
  FaultCode,
  FieldBillingInvoice,
  FieldBillingPayment,
  FieldBillingQuotation,
  FieldBillingSummary,
  FieldPaymentLink,
  FieldPaymentMethod,
  JobCard,
  JobCardPatch,
  JobCardResponse,
  JobCardStatus,
  PresignResponse,
  RecommendedPart,
  WarrantyStatus,
} from './repair-types';

/** Resolve to null on 404, rethrow anything else. */
export async function nullOn404<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

/** Unwrap `T[]` or a paginated `{ items: T[] }` body. */
function asList<T>(res: T[] | { items?: T[] } | null): T[] {
  if (!res) return [];
  return Array.isArray(res) ? res : (res.items ?? []);
}

export const repairApi = {
  /** `null` → repair module not deployed yet. */
  getJobCard: (bookingId: string) =>
    nullOn404(api<JobCardResponse>(`/repair/job-cards/by-booking/${bookingId}`)),

  saveJobCard: (bookingId: string, patch: JobCardPatch) =>
    api<JobCard>(`/repair/job-cards/by-booking/${bookingId}`, { method: 'PUT', body: patch }),

  /** 400 when required checklist items are missing. */
  completeJobCard: (bookingId: string, body: { firstTimeFix?: boolean }) =>
    api<JobCard>(`/repair/job-cards/by-booking/${bookingId}/complete`, { method: 'POST', body }),

  faultCodes: async (params: { category?: string | null; brand?: string | null; q?: string }) =>
    asList(
      await nullOn404(
        api<FaultCode[] | { items: FaultCode[] }>(`/repair/fault-codes`, {
          query: { category: params.category, brand: params.brand, q: params.q },
        }),
      ),
    ),

  catalog: async (params: { category?: string | null }) =>
    asList(
      await nullOn404(
        api<CatalogItem[] | { items: CatalogItem[] }>(`/repair/catalog`, {
          query: { category: params.category, active: true },
        }),
      ),
    ),

  applianceHistory: async (applianceId: string) =>
    asList(
      await nullOn404(
        api<ApplianceHistoryEntry[] | { items: ApplianceHistoryEntry[] }>(
          `/repair/appliances/${applianceId}/history`,
        ),
      ),
    ),

  warrantyStatus: (applianceId: string) =>
    nullOn404(api<WarrantyStatus>(`/repair/appliances/${applianceId}/warranty-status`)),
};

/**
 * Technician-scoped billing (assigned technician only). Replaces the
 * unscoped /invoices, /payments and /quotations/:id/send routes.
 */
export const fieldBillingApi = {
  summary: (bookingId: string) => api<FieldBillingSummary>(`/repair/field-billing/${bookingId}`),

  /** Converts the APPROVED quotation, else final amount / catalog / estimate. Idempotent. */
  raiseInvoice: (bookingId: string) =>
    api<FieldBillingSummary>(`/repair/field-billing/${bookingId}/invoice`, { method: 'POST', body: {} }),

  /** 400 AMOUNT_EXCEEDS_DUE when amountMinor > due. */
  recordPayment: (
    bookingId: string,
    body: { method: FieldPaymentMethod; amountMinor: number; reference?: string },
  ) => api<FieldBillingSummary>(`/repair/field-billing/${bookingId}/payments`, { method: 'POST', body }),

  /** Creates or reuses an open hosted link for the amount due. */
  paymentLink: (bookingId: string) =>
    api<FieldPaymentLink>(`/repair/field-billing/${bookingId}/payment-link`, { method: 'POST', body: {} }),

  sendQuotation: (bookingId: string) =>
    api<FieldBillingQuotation>(`/repair/field-billing/${bookingId}/quotation/send`, { method: 'POST', body: {} }),
};

export const uploadsApi = {
  presign: (body: { filename: string; contentType: string; sizeBytes?: number }) =>
    api<PresignResponse>(`/uploads/presign`, { method: 'POST', body }),
};
