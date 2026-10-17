import type { Prisma } from '@ac/database';

import { nextRepairNumberTx } from '../domain/numbering';
import {
  appendWorkshopHistory,
  initialWorkshopStatus,
  type ServiceModeValue,
  WorkshopStatus,
} from '../domain/workshop-state';

export interface CreateWorkshopJobInput {
  tenantId: string;
  bookingId: string;
  serviceMode: ServiceModeValue;
  actorUserId: string | null;
  warehouseId?: string | null;
  pickupScheduledAt?: Date | null;
  estimatedReadyAt?: Date | null;
  notes?: string | null;
  now?: Date;
}

/**
 * Create a workshop job inside an existing transaction. Shared by the
 * workshop service (manual creation) and the bookings service (auto-create
 * for PICKUP_DROP / CARRY_IN bookings) so numbering + initial history stay
 * identical.
 */
export async function createWorkshopJobTx(
  tx: Prisma.TransactionClient,
  input: CreateWorkshopJobInput,
) {
  const now = input.now ?? new Date();
  const status = initialWorkshopStatus(input.serviceMode);
  const number = await nextRepairNumberTx(tx, 'WS');
  return tx.workshopJob.create({
    data: {
      tenantId: input.tenantId,
      number,
      bookingId: input.bookingId,
      warehouseId: input.warehouseId ?? null,
      status,
      pickupScheduledAt:
        status === WorkshopStatus.PICKUP_SCHEDULED ? (input.pickupScheduledAt ?? null) : null,
      receivedAt: status === WorkshopStatus.RECEIVED_AT_WORKSHOP ? now : null,
      estimatedReadyAt: input.estimatedReadyAt ?? null,
      notes: input.notes ?? null,
      history: appendWorkshopHistory([], {
        status,
        from: null,
        at: now.toISOString(),
        by: input.actorUserId,
        note: 'Workshop job created',
      }) as unknown as Prisma.InputJsonValue,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
    },
  });
}
