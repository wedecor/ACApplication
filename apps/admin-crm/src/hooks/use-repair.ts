'use client';

import type { ServiceCategory } from '@ac/types';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/api/query-keys';
import {
  type ApplianceInput,
  type ApplianceListQuery,
  type CatalogItemInput,
  type ChecklistKind,
  type ChecklistTemplateInput,
  type CreateWarrantyClaimInput,
  type FaultCodeInput,
  type JobCardListQuery,
  repairApi,
  type ServiceMode,
  type WarrantyClaimStatus,
  type WarrantyClaimType,
  type WorkshopStatus,
  type WorkshopTransitionInput,
} from '@/lib/api/repair';

/** Query keys are local to the repair feature to keep query-keys.ts untouched. */
export const repairKeys = {
  all: ['repair'] as const,
  appliances: (q: Record<string, unknown>) => ['repair', 'appliances', q] as const,
  appliance: (id: string) => ['repair', 'appliance', id] as const,
  applianceHistory: (id: string) => ['repair', 'appliance', id, 'history'] as const,
  applianceWarranty: (id: string) => ['repair', 'appliance', id, 'warranty'] as const,
  catalog: (q: Record<string, unknown>) => ['repair', 'catalog', q] as const,
  faultCodes: (q: Record<string, unknown>) => ['repair', 'fault-codes', q] as const,
  checklists: (q: Record<string, unknown>) => ['repair', 'checklists', q] as const,
  jobCards: (q: Record<string, unknown>) => ['repair', 'job-cards', q] as const,
  jobCard: (id: string) => ['repair', 'job-card', id] as const,
  jobCardByBooking: (bookingId: string) => ['repair', 'job-card', 'booking', bookingId] as const,
  claims: (q: Record<string, unknown>) => ['repair', 'claims', q] as const,
  claim: (id: string) => ['repair', 'claim', id] as const,
  warrantyCheck: (q: Record<string, unknown>) => ['repair', 'warranty-check', q] as const,
  workshopJobs: (q: Record<string, unknown>) => ['repair', 'workshop', q] as const,
  workshopJob: (id: string) => ['repair', 'workshop-job', id] as const,
};

function useInvalidateRepair() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: repairKeys.all });
    void qc.invalidateQueries({ queryKey: queryKeys.bookings.all });
  };
}

// --- Appliances -----------------------------------------------------------

export function useAppliances(query: ApplianceListQuery, enabled = true) {
  return useQuery({
    queryKey: repairKeys.appliances(query as Record<string, unknown>),
    queryFn: () => repairApi.listAppliances(query),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useAppliance(id: string | undefined) {
  return useQuery({
    queryKey: repairKeys.appliance(id ?? 'noop'),
    queryFn: () => repairApi.getAppliance(id!),
    enabled: !!id,
  });
}

export function useApplianceHistory(id: string | undefined) {
  return useQuery({
    queryKey: repairKeys.applianceHistory(id ?? 'noop'),
    queryFn: () => repairApi.applianceHistory(id!),
    enabled: !!id,
  });
}

export function useApplianceWarranty(id: string | undefined) {
  return useQuery({
    queryKey: repairKeys.applianceWarranty(id ?? 'noop'),
    queryFn: () => repairApi.applianceWarranty(id!),
    enabled: !!id,
  });
}

export function useSaveAppliance(id?: string) {
  const invalidate = useInvalidateRepair();
  return useMutation({
    mutationFn: (input: ApplianceInput) =>
      id ? repairApi.updateAppliance(id, input) : repairApi.createAppliance(input),
    onSuccess: invalidate,
  });
}

export function useDeleteAppliance() {
  const invalidate = useInvalidateRepair();
  return useMutation({ mutationFn: (id: string) => repairApi.deleteAppliance(id), onSuccess: invalidate });
}

// --- Catalog / fault codes / checklists -----------------------------------

export function useCatalog(query: { category?: ServiceCategory; active?: boolean } = {}) {
  return useQuery({
    queryKey: repairKeys.catalog(query),
    queryFn: () => repairApi.listCatalog(query),
  });
}

export function useSaveCatalogItem() {
  const invalidate = useInvalidateRepair();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: CatalogItemInput }) =>
      id ? repairApi.updateCatalogItem(id, input) : repairApi.createCatalogItem(input),
    onSuccess: invalidate,
  });
}

export function useDeleteCatalogItem() {
  const invalidate = useInvalidateRepair();
  return useMutation({ mutationFn: (id: string) => repairApi.deleteCatalogItem(id), onSuccess: invalidate });
}

export function useFaultCodes(query: { category?: ServiceCategory; brand?: string; q?: string } = {}) {
  return useQuery({
    queryKey: repairKeys.faultCodes(query),
    queryFn: () => repairApi.listFaultCodes(query),
  });
}

export function useSaveFaultCode() {
  const invalidate = useInvalidateRepair();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: FaultCodeInput }) =>
      id ? repairApi.updateFaultCode(id, input) : repairApi.createFaultCode(input),
    onSuccess: invalidate,
  });
}

export function useDeleteFaultCode() {
  const invalidate = useInvalidateRepair();
  return useMutation({ mutationFn: (id: string) => repairApi.deleteFaultCode(id), onSuccess: invalidate });
}

export function useChecklists(query: { category?: ServiceCategory; kind?: ChecklistKind } = {}) {
  return useQuery({
    queryKey: repairKeys.checklists(query),
    queryFn: () => repairApi.listChecklists(query),
  });
}

export function useSaveChecklist() {
  const invalidate = useInvalidateRepair();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ChecklistTemplateInput }) =>
      id ? repairApi.updateChecklist(id, input) : repairApi.createChecklist(input),
    onSuccess: invalidate,
  });
}

export function useDeleteChecklist() {
  const invalidate = useInvalidateRepair();
  return useMutation({ mutationFn: (id: string) => repairApi.deleteChecklist(id), onSuccess: invalidate });
}

// --- Job cards ------------------------------------------------------------

export function useJobCards(query: JobCardListQuery) {
  return useQuery({
    queryKey: repairKeys.jobCards(query as Record<string, unknown>),
    queryFn: () => repairApi.listJobCards(query),
    placeholderData: keepPreviousData,
  });
}

export function useJobCard(id: string | undefined) {
  return useQuery({
    queryKey: repairKeys.jobCard(id ?? 'noop'),
    queryFn: () => repairApi.getJobCard(id!),
    enabled: !!id,
  });
}

export function useJobCardByBooking(bookingId: string | undefined) {
  return useQuery({
    queryKey: repairKeys.jobCardByBooking(bookingId ?? 'noop'),
    queryFn: () => repairApi.getJobCardByBooking(bookingId!),
    enabled: !!bookingId,
  });
}

// --- Warranty -------------------------------------------------------------

export function useWarrantyCheck(query: { bookingId?: string; applianceId?: string }, enabled = true) {
  return useQuery({
    queryKey: repairKeys.warrantyCheck(query),
    queryFn: () => repairApi.checkWarranty(query),
    enabled: enabled && !!(query.bookingId || query.applianceId),
  });
}

export function useWarrantyClaims(query: {
  page?: number;
  pageSize?: number;
  status?: WarrantyClaimStatus;
  type?: WarrantyClaimType;
  search?: string;
  customerId?: string;
}) {
  return useQuery({
    queryKey: repairKeys.claims(query),
    queryFn: () => repairApi.listClaims(query),
    placeholderData: keepPreviousData,
  });
}

export function useWarrantyClaim(id: string | undefined) {
  return useQuery({
    queryKey: repairKeys.claim(id ?? 'noop'),
    queryFn: () => repairApi.getClaim(id!),
    enabled: !!id,
  });
}

export function useCreateWarrantyClaim() {
  const invalidate = useInvalidateRepair();
  return useMutation({
    mutationFn: (input: CreateWarrantyClaimInput) => repairApi.createClaim(input),
    onSuccess: invalidate,
  });
}

export function useDecideClaim(id: string) {
  const invalidate = useInvalidateRepair();
  return useMutation({
    mutationFn: (body: { approve: boolean; notes?: string }) => repairApi.decideClaim(id, body),
    onSuccess: invalidate,
  });
}

export function useScheduleRevisit(id: string) {
  const invalidate = useInvalidateRepair();
  return useMutation({
    mutationFn: (body: { scheduledAt: string; scheduledTimeSlot?: string; notes?: string }) =>
      repairApi.scheduleRevisit(id, body),
    onSuccess: invalidate,
  });
}

export function useUpdateOem(id: string) {
  const invalidate = useInvalidateRepair();
  return useMutation({
    mutationFn: (body: {
      status: 'SUBMITTED_TO_OEM' | 'SETTLED';
      oemClaimRef?: string;
      settledAmountMinor?: number;
    }) => repairApi.updateOem(id, body),
    onSuccess: invalidate,
  });
}

// --- Workshop -------------------------------------------------------------

export function useWorkshopJobs(query: {
  page?: number;
  pageSize?: number;
  status?: WorkshopStatus[];
  search?: string;
}) {
  return useQuery({
    queryKey: repairKeys.workshopJobs(query),
    queryFn: () => repairApi.listWorkshopJobs(query),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}

export function useCreateWorkshopJob() {
  const invalidate = useInvalidateRepair();
  return useMutation({
    mutationFn: (body: { bookingId: string; pickupScheduledAt?: string; estimatedReadyAt?: string }) =>
      repairApi.createWorkshopJob(body),
    onSuccess: invalidate,
  });
}

export function useTransitionWorkshopJob() {
  const invalidate = useInvalidateRepair();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: WorkshopTransitionInput }) =>
      repairApi.transitionWorkshopJob(id, input),
    onSuccess: invalidate,
  });
}

// --- Booking repair fields ------------------------------------------------

export function useUpdateBookingRepairFields(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { applianceId?: string | null; catalogItemId?: string | null; serviceMode?: ServiceMode }) =>
      repairApi.updateBookingRepairFields(bookingId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.bookings.detail(bookingId) });
      void qc.invalidateQueries({ queryKey: repairKeys.all });
    },
  });
}
