import { NotificationChannel } from '@ac/types';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { type RepairEventEnvelope,RepairEventName } from './domain/events';
import { WorkshopStatus } from './domain/workshop-state';

/** Customer-facing copy for each workshop status. */
export const WORKSHOP_STATUS_LABEL: Record<WorkshopStatus, string> = {
  PICKUP_SCHEDULED: 'pickup scheduled',
  PICKED_UP: 'picked up from your home',
  RECEIVED_AT_WORKSHOP: 'received at our workshop',
  DIAGNOSING: 'being diagnosed',
  AWAITING_APPROVAL: 'awaiting your approval of the estimate',
  REPAIRING: 'under repair',
  READY_FOR_DELIVERY: 'repaired and ready',
  OUT_FOR_DELIVERY: 'out for delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

/** Statuses the customer is notified about (internal bench steps are skipped). */
const NOTIFY_ON: ReadonlySet<WorkshopStatus> = new Set([
  WorkshopStatus.PICKED_UP,
  WorkshopStatus.RECEIVED_AT_WORKSHOP,
  WorkshopStatus.AWAITING_APPROVAL,
  WorkshopStatus.READY_FOR_DELIVERY,
  WorkshopStatus.OUT_FOR_DELIVERY,
  WorkshopStatus.DELIVERED,
  WorkshopStatus.CANCELLED,
]);

/**
 * Fans repair events out to customer notifications. Best-effort: failures
 * are logged (without recipient details) and never re-thrown.
 */
@Injectable()
export class RepairNotificationListener {
  private readonly logger = new Logger(RepairNotificationListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @OnEvent(RepairEventName.WorkshopStatusChanged, { async: true })
  async onWorkshopStatusChanged(
    event: RepairEventEnvelope<typeof RepairEventName.WorkshopStatusChanged>,
  ): Promise<void> {
    const { to, bookingId, number } = event.payload;
    if (!NOTIFY_ON.has(to)) return;
    const booking = await this.prisma.client.booking.findUnique({
      where: { id: bookingId },
      select: {
        tenantId: true,
        code: true,
        customer: { select: { userId: true, phone: true, fullName: true } },
      },
    });
    if (!booking?.customer) return;
    await this.safeEnqueue(
      booking.tenantId,
      { userId: booking.customer.userId, phone: booking.customer.phone },
      [NotificationChannel.WHATSAPP, NotificationChannel.SMS, NotificationChannel.PUSH],
      'workshop.status_changed',
      {
        code: booking.code,
        number,
        status: to,
        statusLabel: WORKSHOP_STATUS_LABEL[to],
        customerName: booking.customer.fullName,
      },
      `workshop:${event.payload.workshopJobId}:${to}`,
    );
  }

  @OnEvent(RepairEventName.WarrantyClaimDecided, { async: true })
  async onClaimDecided(
    event: RepairEventEnvelope<typeof RepairEventName.WarrantyClaimDecided>,
  ): Promise<void> {
    const customer = await this.prisma.client.customer.findFirst({
      where: { id: event.payload.customerId },
      select: { tenantId: true, userId: true, phone: true, fullName: true },
    });
    if (!customer) return;
    await this.safeEnqueue(
      customer.tenantId,
      { userId: customer.userId, phone: customer.phone },
      [NotificationChannel.WHATSAPP, NotificationChannel.SMS],
      'warranty.claim_decided',
      {
        number: event.payload.number,
        decision: event.payload.approved ? 'approved' : 'rejected',
        customerName: customer.fullName,
      },
      `warranty:${event.payload.claimId}:decided`,
    );
  }

  @OnEvent(RepairEventName.WarrantyRevisitScheduled, { async: true })
  async onRevisitScheduled(
    event: RepairEventEnvelope<typeof RepairEventName.WarrantyRevisitScheduled>,
  ): Promise<void> {
    const booking = await this.prisma.client.booking.findUnique({
      where: { id: event.payload.revisitBookingId },
      select: {
        tenantId: true,
        code: true,
        scheduledAt: true,
        customer: { select: { userId: true, phone: true, fullName: true } },
      },
    });
    if (!booking?.customer) return;
    await this.safeEnqueue(
      booking.tenantId,
      { userId: booking.customer.userId, phone: booking.customer.phone },
      [NotificationChannel.WHATSAPP, NotificationChannel.SMS],
      'warranty.revisit_scheduled',
      {
        number: event.payload.number,
        code: booking.code,
        scheduledAt: booking.scheduledAt.toISOString(),
        customerName: booking.customer.fullName,
      },
      `warranty:${event.payload.claimId}:revisit`,
    );
  }

  private async safeEnqueue(
    tenantId: string,
    recipient: { userId?: string | null; phone?: string | null },
    channels: NotificationChannel[],
    template: string,
    data: Record<string, unknown>,
    idempotencyKey?: string,
  ): Promise<void> {
    try {
      await this.notifications.enqueue(
        tenantId,
        { userId: recipient.userId ?? undefined, phone: recipient.phone ?? undefined },
        channels,
        { template, data, idempotencyKey },
      );
    } catch (err) {
      this.logger.warn({ err, template }, 'Repair notification enqueue failed');
    }
  }
}
