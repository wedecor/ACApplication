/**
 * Repair-domain event names + payloads.
 *
 * These are not (yet) part of the shared `DomainEventName` registry in
 * `@ac/types`; `RepairEventsService` publishes them through the same
 * `DomainEventBus` (event store + Redis fan-out + in-process emit) so
 * listeners can subscribe with `@OnEvent(RepairEventName.X)`.
 */
import type { WorkshopStatus } from './workshop-state';

export const RepairEventName = {
  WorkshopJobCreated: 'repair.workshop_job_created',
  WorkshopStatusChanged: 'repair.workshop_status_changed',
  WarrantyClaimCreated: 'repair.warranty_claim_created',
  WarrantyClaimDecided: 'repair.warranty_claim_decided',
  WarrantyRevisitScheduled: 'repair.warranty_revisit_scheduled',
  WarrantyClaimOemUpdated: 'repair.warranty_claim_oem_updated',
  JobCardCompleted: 'repair.job_card_completed',
} as const;
export type RepairEventName = (typeof RepairEventName)[keyof typeof RepairEventName];

export interface RepairEventPayloads {
  [RepairEventName.WorkshopJobCreated]: {
    tenantId: string;
    workshopJobId: string;
    bookingId: string;
    number: string;
    status: WorkshopStatus;
  };
  [RepairEventName.WorkshopStatusChanged]: {
    tenantId: string;
    workshopJobId: string;
    bookingId: string;
    number: string;
    from: WorkshopStatus;
    to: WorkshopStatus;
  };
  [RepairEventName.WarrantyClaimCreated]: {
    tenantId: string;
    claimId: string;
    number: string;
    type: string;
    customerId: string;
  };
  [RepairEventName.WarrantyClaimDecided]: {
    tenantId: string;
    claimId: string;
    number: string;
    approved: boolean;
    customerId: string;
  };
  [RepairEventName.WarrantyRevisitScheduled]: {
    tenantId: string;
    claimId: string;
    number: string;
    revisitBookingId: string;
    customerId: string;
  };
  [RepairEventName.WarrantyClaimOemUpdated]: {
    tenantId: string;
    claimId: string;
    number: string;
    status: string;
  };
  [RepairEventName.JobCardCompleted]: {
    tenantId: string;
    jobCardId: string;
    bookingId: string;
    firstTimeFix: boolean | null;
  };
}

export interface RepairEventEnvelope<TName extends RepairEventName> {
  id: string;
  name: TName;
  occurredAt: string;
  actorId: string | null;
  payload: RepairEventPayloads[TName];
}
