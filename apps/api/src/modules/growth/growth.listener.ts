/**
 * Growth side-effects driven by domain events (no edits to the invoices or
 * bookings modules needed):
 *
 *   InvoiceCreated   → apply the booking's coupon to the DRAFT invoice + redeem
 *   InvoicePaid      → accrue loyalty points (idempotent per invoice)
 *   BookingCompleted → qualify/reward referrals; schedule the review request
 */
import {
  type BookingCompletedEvent,
  DomainEventName,
  type InvoiceCreatedEvent,
  type InvoicePaidEvent,
} from '@ac/types';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { CouponsService } from './coupons.service';
import { LoyaltyService } from './loyalty.service';
import { ReferralsService } from './referrals.service';
import { ReviewsService } from './reviews.service';

@Injectable()
export class GrowthListener {
  private readonly logger = new Logger(GrowthListener.name);

  constructor(
    private readonly coupons: CouponsService,
    private readonly loyalty: LoyaltyService,
    private readonly referrals: ReferralsService,
    private readonly reviews: ReviewsService,
  ) {}

  @OnEvent(DomainEventName.InvoiceCreated, { async: true })
  async onInvoiceCreated(event: InvoiceCreatedEvent): Promise<void> {
    if (!event.payload.bookingId) return;
    try {
      await this.coupons.applyBookingCouponToInvoice(event.payload.invoiceId);
    } catch (err) {
      this.logger.warn({ err, invoiceId: event.payload.invoiceId }, 'Coupon application failed');
    }
  }

  @OnEvent(DomainEventName.InvoicePaid, { async: true })
  async onInvoicePaid(event: InvoicePaidEvent): Promise<void> {
    try {
      await this.loyalty.accrueForInvoice(event.payload.invoiceId);
    } catch (err) {
      this.logger.warn({ err, invoiceId: event.payload.invoiceId }, 'Loyalty accrual failed');
    }
  }

  @OnEvent(DomainEventName.BookingCompleted, { async: true })
  async onBookingCompleted(event: BookingCompletedEvent): Promise<void> {
    const { bookingId } = event.payload;
    try {
      await this.referrals.onBookingCompleted(bookingId);
    } catch (err) {
      this.logger.warn({ err, bookingId }, 'Referral qualification failed');
    }
    try {
      await this.reviews.onBookingCompleted(bookingId);
    } catch (err) {
      this.logger.warn({ err, bookingId }, 'Review request scheduling failed');
    }
  }
}
