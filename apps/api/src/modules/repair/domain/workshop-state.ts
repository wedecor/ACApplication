/**
 * Workshop (pickup/drop + carry-in) job state machine. Pure — no I/O — so it
 * can be unit tested and reused by the bookings module when it auto-creates
 * a workshop job.
 */

export const WorkshopStatus = {
  PICKUP_SCHEDULED: 'PICKUP_SCHEDULED',
  PICKED_UP: 'PICKED_UP',
  RECEIVED_AT_WORKSHOP: 'RECEIVED_AT_WORKSHOP',
  DIAGNOSING: 'DIAGNOSING',
  AWAITING_APPROVAL: 'AWAITING_APPROVAL',
  REPAIRING: 'REPAIRING',
  READY_FOR_DELIVERY: 'READY_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;
export type WorkshopStatus = (typeof WorkshopStatus)[keyof typeof WorkshopStatus];

export const WORKSHOP_STATUSES = Object.values(WorkshopStatus);

export type ServiceModeValue = 'ON_SITE' | 'PICKUP_DROP' | 'CARRY_IN';

export const TERMINAL_WORKSHOP_STATUSES: ReadonlySet<WorkshopStatus> = new Set([
  WorkshopStatus.DELIVERED,
  WorkshopStatus.CANCELLED,
]);

/** Forward edges of the happy path. */
const FORWARD: Record<WorkshopStatus, WorkshopStatus[]> = {
  PICKUP_SCHEDULED: [WorkshopStatus.PICKED_UP],
  PICKED_UP: [WorkshopStatus.RECEIVED_AT_WORKSHOP],
  RECEIVED_AT_WORKSHOP: [WorkshopStatus.DIAGNOSING],
  // Approval can be skipped when the repair is within the quoted estimate.
  DIAGNOSING: [WorkshopStatus.AWAITING_APPROVAL, WorkshopStatus.REPAIRING],
  AWAITING_APPROVAL: [WorkshopStatus.REPAIRING],
  REPAIRING: [WorkshopStatus.READY_FOR_DELIVERY],
  READY_FOR_DELIVERY: [WorkshopStatus.OUT_FOR_DELIVERY],
  OUT_FOR_DELIVERY: [WorkshopStatus.DELIVERED],
  DELIVERED: [],
  CANCELLED: [],
};

/** Initial status for a freshly created workshop job. */
export function initialWorkshopStatus(mode: ServiceModeValue): WorkshopStatus {
  return mode === 'CARRY_IN' ? WorkshopStatus.RECEIVED_AT_WORKSHOP : WorkshopStatus.PICKUP_SCHEDULED;
}

export function canTransitionWorkshop(
  from: WorkshopStatus,
  to: WorkshopStatus,
  mode: ServiceModeValue = 'PICKUP_DROP',
): boolean {
  if (from === to) return false;
  if (TERMINAL_WORKSHOP_STATUSES.has(from)) return false;
  if (to === WorkshopStatus.CANCELLED) return true;
  if (FORWARD[from].includes(to)) return true;
  // Carry-in customers collect from the counter — no delivery run.
  if (
    mode === 'CARRY_IN' &&
    from === WorkshopStatus.READY_FOR_DELIVERY &&
    to === WorkshopStatus.DELIVERED
  ) {
    return true;
  }
  return false;
}

export function allowedWorkshopTransitions(
  from: WorkshopStatus,
  mode: ServiceModeValue = 'PICKUP_DROP',
): WorkshopStatus[] {
  return WORKSHOP_STATUSES.filter((to) => canTransitionWorkshop(from, to, mode));
}

/** Which timestamp column (if any) to stamp when entering a status. */
export function workshopTimestampField(
  to: WorkshopStatus,
):
  | 'pickedUpAt'
  | 'receivedAt'
  | 'readyAt'
  | 'outForDeliveryAt'
  | 'deliveredAt'
  | null {
  switch (to) {
    case WorkshopStatus.PICKED_UP:
      return 'pickedUpAt';
    case WorkshopStatus.RECEIVED_AT_WORKSHOP:
      return 'receivedAt';
    case WorkshopStatus.READY_FOR_DELIVERY:
      return 'readyAt';
    case WorkshopStatus.OUT_FOR_DELIVERY:
      return 'outForDeliveryAt';
    case WorkshopStatus.DELIVERED:
      return 'deliveredAt';
    default:
      return null;
  }
}

export interface WorkshopHistoryEntry {
  status: WorkshopStatus;
  from: WorkshopStatus | null;
  at: string;
  by: string | null;
  note: string | null;
}

export function appendWorkshopHistory(
  history: unknown,
  entry: WorkshopHistoryEntry,
): WorkshopHistoryEntry[] {
  const list = Array.isArray(history) ? (history as WorkshopHistoryEntry[]) : [];
  return [...list, entry];
}
