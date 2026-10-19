import {
  type BookingCreatedEvent,
  type BookingStatusChangedEvent,
  DomainEventName,
  type InvoicePaidEvent,
  type InvoicePartiallyPaidEvent,
  type InvoiceRefundedEvent,
  type PaymentRefundedEvent,
} from '@ac/types';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Keeps the denormalised `Customer.totalBookings` and `lifetimeValueMinor`
 * in step with bookings and invoices. Each run recomputes from source rows,
 * so duplicate or out-of-order events are harmless.
 *
 *  - totalBookings: non-deleted bookings, excluding drafts.
 *  - lifetimeValueMinor: paid minus refunded across non-cancelled invoices.
 */
@Injectable()
export class CustomerStatsService {
  private readonly logger = new Logger(CustomerStatsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recompute(customerId: string): Promise<{ totalBookings: number; lifetimeValueMinor: number } | null> {
    const db = this.prisma.client;
    const [totalBookings, invoiceSums] = await Promise.all([
      db.booking.count({ where: { customerId, deletedAt: null, status: { not: 'DRAFT' } } }),
      db.invoice.aggregate({
        where: { customerId, deletedAt: null, status: { not: 'CANCELLED' } },
        _sum: { amountPaidMinor: true, amountRefundedMinor: true },
      }),
    ]);
    const lifetimeValueMinor = Math.max(
      0,
      (invoiceSums._sum.amountPaidMinor ?? 0) - (invoiceSums._sum.amountRefundedMinor ?? 0),
    );
    const updated = await db.customer.updateMany({
      where: { id: customerId },
      data: { totalBookings, lifetimeValueMinor: BigInt(lifetimeValueMinor) },
    });
    return updated.count ? { totalBookings, lifetimeValueMinor } : null;
  }

  @OnEvent(DomainEventName.BookingCreated, { async: true })
  onBookingCreated(event: BookingCreatedEvent) {
    return this.safe(event.payload.customerId);
  }

  @OnEvent(DomainEventName.BookingStatusChanged, { async: true })
  async onBookingStatusChanged(event: BookingStatusChangedEvent) {
    const booking = await this.prisma.client.booking.findUnique({
      where: { id: event.payload.bookingId },
      select: { customerId: true },
    });
    if (booking) await this.safe(booking.customerId);
  }

  @OnEvent(DomainEventName.InvoicePaid, { async: true })
  onInvoicePaid(event: InvoicePaidEvent) {
    return this.safe(event.payload.customerId);
  }

  @OnEvent(DomainEventName.InvoicePartiallyPaid, { async: true })
  onInvoicePartiallyPaid(event: InvoicePartiallyPaidEvent) {
    return this.fromInvoice(event.payload.invoiceId);
  }

  @OnEvent(DomainEventName.InvoiceRefunded, { async: true })
  onInvoiceRefunded(event: InvoiceRefundedEvent) {
    return this.fromInvoice(event.payload.invoiceId);
  }

  @OnEvent(DomainEventName.PaymentRefunded, { async: true })
  onPaymentRefunded(event: PaymentRefundedEvent) {
    return this.safe(event.payload.customerId);
  }

  private async fromInvoice(invoiceId: string) {
    const invoice = await this.prisma.client.invoice.findUnique({
      where: { id: invoiceId },
      select: { customerId: true },
    });
    if (invoice) await this.safe(invoice.customerId);
  }

  /** Listeners must never throw back into the emitter. */
  private async safe(customerId: string) {
    try {
      await this.recompute(customerId);
    } catch (err) {
      this.logger.warn(`Customer stats recompute failed for ${customerId}: ${(err as Error).message}`);
    }
  }
}
