/**
 * Finance side-effect listeners — purely orchestration glue.
 *
 *   • InvoicePaid → if the invoice was for an AMC signup, flip the
 *     subscription to ACTIVE + seed its visit schedule.
 *   • BookingCompleted → accrue a `TechnicianCommission` row using the
 *     technician's commission rule.
 *
 * Keeping these out of `notification.listener` makes the side-effects
 * easy to test in isolation and avoids notification timing risks
 * (notification dispatch shouldn't block side-effect orchestration).
 */

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import {
  type BookingCompletedEvent,
  DomainEventName,
  type InvoicePaidEvent,
} from '@ac/types';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AmcSubscriptionsService } from '../amc/amc-subscriptions.service';
import { PayoutsService } from '../payouts/payouts.service';

@Injectable()
export class FinanceEventsListener {
  private readonly logger = new Logger(FinanceEventsListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly amc: AmcSubscriptionsService,
    private readonly payouts: PayoutsService,
  ) {}

  @OnEvent(DomainEventName.InvoicePaid, { async: true })
  async onInvoicePaid(event: InvoicePaidEvent): Promise<void> {
    const inv = await this.prisma.client.invoice.findUnique({
      where: { id: event.payload.invoiceId },
      select: { amcSubscriptionId: true },
    });
    if (inv?.amcSubscriptionId) {
      try {
        await this.amc.onSubscriptionInvoicePaid(inv.amcSubscriptionId);
      } catch (err) {
        this.logger.warn({ err }, 'Failed to activate AMC subscription on invoice paid');
      }
    }
  }

  @OnEvent(DomainEventName.BookingCompleted, { async: true })
  async onBookingCompleted(event: BookingCompletedEvent): Promise<void> {
    try {
      await this.payouts.accrueForBooking(event.payload.bookingId);
    } catch (err) {
      this.logger.warn({ err }, 'Failed to accrue commission for completed booking');
    }
  }
}
