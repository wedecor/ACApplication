import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  type AmcSubscriptionExpiringSoonEvent,
  type AmcSubscriptionRenewedEvent,
  type BookingAssignedEvent,
  type BookingCompletedEvent,
  type BookingCreatedEvent,
  type BookingOtpSentEvent,
  BookingStatus,
  type BookingStatusChangedEvent,
  DomainEventName,
  type InvoiceOverdueEvent,
  type InvoicePaidEvent,
  type InvoicePartiallyPaidEvent,
  type InvoiceSentEvent,
  type LeadAssignedEvent,
  NotificationChannel,
  type PaymentFailedEvent,
  type PaymentSucceededEvent,
  type QuotationApprovedEvent,
  type QuotationViewedEvent,
  type TechnicianArrivedEvent,
  type TechnicianDelayedEvent,
} from '@ac/types';

import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from './notifications.service';

/**
 * Subscribes to domain events and produces customer / technician / ops
 * notifications. Each handler:
 *   1. Resolves recipients from the DB (lazy — no payload bloat),
 *   2. Picks the channel(s) per template,
 *   3. Enqueues async delivery (persisted + BullMQ worker).
 *
 * Failures are logged but never re-thrown — notifications are best-effort.
 */
@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent(DomainEventName.LeadAssigned, { async: true })
  async onLeadAssigned(event: LeadAssignedEvent): Promise<void> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: event.payload.assignedUserId },
      select: { id: true, email: true, phone: true, tenantId: true },
    });
    if (!user) return;
    await this.safeEnqueue(
      user.tenantId,
      { userId: user.id, email: user.email ?? undefined, phone: user.phone ?? undefined },
      [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      'lead.assigned',
      { leadId: event.payload.leadId },
    );
  }

  @OnEvent(DomainEventName.BookingCreated, { async: true })
  async onBookingCreated(event: BookingCreatedEvent): Promise<void> {
    const booking = await this.prisma.client.booking.findUnique({
      where: { id: event.payload.bookingId },
      include: {
        customer: { select: { phone: true, email: true, fullName: true, userId: true } },
      },
    });
    if (!booking?.customer) return;
    await this.safeEnqueue(
      booking.tenantId,
      {
        userId: booking.customer.userId,
        phone: booking.customer.phone,
        email: booking.customer.email ?? undefined,
      },
      [NotificationChannel.WHATSAPP, NotificationChannel.SMS, NotificationChannel.EMAIL],
      'booking.confirmation',
      {
        code: booking.code,
        customerName: booking.customer.fullName,
        scheduledAt: booking.scheduledAt.toISOString(),
      },
    );
  }

  @OnEvent(DomainEventName.BookingAssigned, { async: true })
  async onBookingAssigned(event: BookingAssignedEvent): Promise<void> {
    const [booking, tech] = await Promise.all([
      this.prisma.client.booking.findUnique({
        where: { id: event.payload.bookingId },
        include: { customer: { select: { phone: true, fullName: true, userId: true } } },
      }),
      this.prisma.client.technician.findUnique({
        where: { id: event.payload.technicianId },
        select: { userId: true, phone: true, fullName: true, tenantId: true },
      }),
    ]);
    if (booking?.customer) {
      await this.safeEnqueue(
        booking.tenantId,
        {
          userId: booking.customer.userId,
          phone: booking.customer.phone,
        },
        [NotificationChannel.WHATSAPP, NotificationChannel.SMS],
        'booking.technician_assigned',
        {
          code: booking.code,
          technician: tech?.fullName ?? 'Your technician',
        },
      );
    }
    if (tech) {
      await this.safeEnqueue(
        tech.tenantId,
        { userId: tech.userId, phone: tech.phone },
        [NotificationChannel.PUSH, NotificationChannel.WHATSAPP],
        'technician.job_assigned',
        { code: booking?.code ?? '', technicianName: tech.fullName },
      );
    }
  }

  @OnEvent(DomainEventName.BookingOtpSent, { async: true })
  async onBookingOtpSent(event: BookingOtpSentEvent): Promise<void> {
    const booking = await this.prisma.client.booking.findUnique({
      where: { id: event.payload.bookingId },
      include: {
        customer: { select: { phone: true, fullName: true, userId: true } },
      },
    });
    if (!booking?.customer) return;
    await this.safeEnqueue(
      booking.tenantId,
      { userId: booking.customer.userId, phone: booking.customer.phone },
      [NotificationChannel.SMS, NotificationChannel.WHATSAPP],
      'booking.otp',
      { code: booking.code, customerName: booking.customer.fullName },
    );
  }

  @OnEvent(DomainEventName.TechnicianArrived, { async: true })
  async onTechArrived(event: TechnicianArrivedEvent): Promise<void> {
    const booking = await this.prisma.client.booking.findUnique({
      where: { id: event.payload.bookingId },
      include: {
        customer: { select: { phone: true, fullName: true, userId: true } },
      },
    });
    if (!booking?.customer) return;
    await this.safeEnqueue(
      booking.tenantId,
      { userId: booking.customer.userId, phone: booking.customer.phone },
      [NotificationChannel.WHATSAPP, NotificationChannel.SMS, NotificationChannel.PUSH],
      'booking.technician_reached',
      { code: booking.code, customerName: booking.customer.fullName },
    );
  }

  @OnEvent(DomainEventName.TechnicianDelayed, { async: true })
  async onTechDelayed(event: TechnicianDelayedEvent): Promise<void> {
    const booking = await this.prisma.client.booking.findUnique({
      where: { id: event.payload.bookingId },
      include: {
        customer: { select: { phone: true, fullName: true, userId: true } },
      },
    });
    if (!booking?.customer) return;
    await this.safeEnqueue(
      booking.tenantId,
      { userId: booking.customer.userId, phone: booking.customer.phone },
      [NotificationChannel.WHATSAPP, NotificationChannel.SMS],
      'booking.delay',
      {
        code: booking.code,
        customerName: booking.customer.fullName,
        minutesLate: event.payload.minutesLate,
      },
    );
  }

  /**
   * Status-driven notifications — keeps the user informed at every step
   * (en-route, service started, completed handled separately for richness).
   */
  @OnEvent(DomainEventName.BookingStatusChanged, { async: true })
  async onStatusChanged(event: BookingStatusChangedEvent): Promise<void> {
    const status = event.payload.to;
    let template: string | null = null;
    if (status === BookingStatus.TECHNICIAN_EN_ROUTE) template = 'booking.technician_arriving';
    else if (status === BookingStatus.IN_PROGRESS) template = 'booking.service_started';
    if (!template) return;

    const booking = await this.prisma.client.booking.findUnique({
      where: { id: event.payload.bookingId },
      include: {
        customer: { select: { phone: true, fullName: true, userId: true } },
        technician: { select: { fullName: true, phone: true } },
      },
    });
    if (!booking?.customer) return;
    await this.safeEnqueue(
      booking.tenantId,
      { userId: booking.customer.userId, phone: booking.customer.phone },
      [NotificationChannel.WHATSAPP, NotificationChannel.SMS, NotificationChannel.PUSH],
      template,
      {
        code: booking.code,
        customerName: booking.customer.fullName,
        technician: booking.technician?.fullName ?? null,
        technicianPhone: booking.technician?.phone ?? null,
      },
    );
  }

  @OnEvent(DomainEventName.BookingCompleted, { async: true })
  async onBookingCompleted(event: BookingCompletedEvent): Promise<void> {
    const booking = await this.prisma.client.booking.findUnique({
      where: { id: event.payload.bookingId },
      include: {
        customer: { select: { phone: true, email: true, fullName: true, userId: true } },
      },
    });
    if (!booking?.customer) return;
    await this.safeEnqueue(
      booking.tenantId,
      {
        userId: booking.customer.userId,
        phone: booking.customer.phone,
        email: booking.customer.email ?? undefined,
      },
      [NotificationChannel.WHATSAPP, NotificationChannel.EMAIL],
      'booking.completed',
      { code: booking.code, customerName: booking.customer.fullName },
    );
  }

  // ============================================================ FINANCE
  @OnEvent(DomainEventName.InvoiceSent, { async: true })
  async onInvoiceSent(event: InvoiceSentEvent): Promise<void> {
    const invoice = await this.loadInvoiceForNotification(event.payload.invoiceId);
    if (!invoice) return;
    await this.safeEnqueue(
      invoice.tenantId,
      this.recipientFor(invoice.customer),
      [NotificationChannel.WHATSAPP, NotificationChannel.EMAIL, NotificationChannel.SMS],
      'invoice.generated',
      this.invoiceTemplateData(invoice),
    );
  }

  @OnEvent(DomainEventName.InvoicePaid, { async: true })
  async onInvoicePaid(event: InvoicePaidEvent): Promise<void> {
    const invoice = await this.loadInvoiceForNotification(event.payload.invoiceId);
    if (!invoice) return;
    await this.safeEnqueue(
      invoice.tenantId,
      this.recipientFor(invoice.customer),
      [NotificationChannel.WHATSAPP, NotificationChannel.EMAIL, NotificationChannel.PUSH],
      'payment.success',
      {
        ...this.invoiceTemplateData(invoice),
        paidAmountMinor: event.payload.paidAmountMinor,
      },
    );
  }

  @OnEvent(DomainEventName.InvoicePartiallyPaid, { async: true })
  async onInvoicePartial(event: InvoicePartiallyPaidEvent): Promise<void> {
    const invoice = await this.loadInvoiceForNotification(event.payload.invoiceId);
    if (!invoice) return;
    await this.safeEnqueue(
      invoice.tenantId,
      this.recipientFor(invoice.customer),
      [NotificationChannel.WHATSAPP, NotificationChannel.PUSH],
      'payment.partial',
      {
        ...this.invoiceTemplateData(invoice),
        amountPaidMinor: event.payload.amountPaidMinor,
        dueAmountMinor: event.payload.dueAmountMinor,
      },
    );
  }

  @OnEvent(DomainEventName.PaymentSucceeded, { async: true })
  async onPaymentSucceeded(event: PaymentSucceededEvent): Promise<void> {
    if (!event.payload.invoiceId) return;
    const invoice = await this.loadInvoiceForNotification(event.payload.invoiceId);
    if (!invoice) return;
    // Light "receipt" follow-up — the InvoicePaid template handles the
    // primary thank-you when the invoice is fully settled.
    await this.safeEnqueue(
      invoice.tenantId,
      this.recipientFor(invoice.customer),
      [NotificationChannel.PUSH],
      'payment.receipt',
      this.invoiceTemplateData(invoice),
    );
  }

  @OnEvent(DomainEventName.PaymentFailed, { async: true })
  async onPaymentFailed(event: PaymentFailedEvent): Promise<void> {
    if (!event.payload.invoiceId) return;
    const invoice = await this.loadInvoiceForNotification(event.payload.invoiceId);
    if (!invoice) return;
    await this.safeEnqueue(
      invoice.tenantId,
      this.recipientFor(invoice.customer),
      [NotificationChannel.WHATSAPP, NotificationChannel.SMS, NotificationChannel.PUSH],
      'payment.failed',
      {
        ...this.invoiceTemplateData(invoice),
        reason: event.payload.reason,
      },
    );
  }

  @OnEvent(DomainEventName.InvoiceOverdue, { async: true })
  async onInvoiceOverdue(event: InvoiceOverdueEvent): Promise<void> {
    const invoice = await this.loadInvoiceForNotification(event.payload.invoiceId);
    if (!invoice) return;
    await this.safeEnqueue(
      invoice.tenantId,
      this.recipientFor(invoice.customer),
      [NotificationChannel.WHATSAPP, NotificationChannel.SMS, NotificationChannel.EMAIL],
      'invoice.overdue',
      {
        ...this.invoiceTemplateData(invoice),
        daysOverdue: event.payload.daysOverdue,
      },
    );
  }

  @OnEvent(DomainEventName.QuotationViewed, { async: true })
  async onQuotationViewed(event: QuotationViewedEvent): Promise<void> {
    // Internal: notify ops that a customer engaged with the quote.
    this.logger.log(`Quotation ${event.payload.quotationId} viewed at ${event.payload.viewedAt}`);
  }

  @OnEvent(DomainEventName.QuotationApproved, { async: true })
  async onQuotationApproved(event: QuotationApprovedEvent): Promise<void> {
    const q = await this.prisma.client.quotation.findUnique({
      where: { id: event.payload.quotationId },
      include: { customer: true },
    });
    if (!q) return;
    // Ping ops + reply to the customer.
    await this.safeEnqueue(
      q.tenantId,
      this.recipientFor(q.customer),
      [NotificationChannel.WHATSAPP, NotificationChannel.EMAIL],
      'quotation.approved',
      { number: q.number, totalMinor: q.totalMinor },
    );
  }

  @OnEvent(DomainEventName.AmcSubscriptionExpiringSoon, { async: true })
  async onAmcExpiringSoon(event: AmcSubscriptionExpiringSoonEvent): Promise<void> {
    const sub = await this.prisma.client.aMCSubscription.findUnique({
      where: { id: event.payload.subscriptionId },
      include: { customer: true, plan: true },
    });
    if (!sub) return;
    await this.safeEnqueue(
      sub.tenantId,
      this.recipientFor(sub.customer),
      [NotificationChannel.WHATSAPP, NotificationChannel.EMAIL, NotificationChannel.SMS],
      'amc.renewal_reminder',
      {
        number: sub.number,
        planName: sub.plan.name,
        daysUntilExpiry: event.payload.daysUntilExpiry,
        endsAt: sub.endsAt.toISOString(),
      },
    );
  }

  @OnEvent(DomainEventName.AmcSubscriptionRenewed, { async: true })
  async onAmcRenewed(event: AmcSubscriptionRenewedEvent): Promise<void> {
    const sub = await this.prisma.client.aMCSubscription.findUnique({
      where: { id: event.payload.subscriptionId },
      include: { customer: true, plan: true },
    });
    if (!sub) return;
    await this.safeEnqueue(
      sub.tenantId,
      this.recipientFor(sub.customer),
      [NotificationChannel.WHATSAPP, NotificationChannel.EMAIL],
      'amc.renewal_invoice',
      { number: sub.number, planName: sub.plan.name, newEndsAt: event.payload.newEndsAt },
    );
  }

  // ---------------------------------------------------------------- helpers
  private recipientFor(customer: {
    userId: string;
    phone?: string | null;
    email?: string | null;
  }) {
    return {
      userId: customer.userId,
      phone: customer.phone ?? undefined,
      email: customer.email ?? undefined,
    };
  }

  private invoiceTemplateData(invoice: {
    number: string;
    totalMinor: number;
    dueAmountMinor: number;
    dueDate: Date | null;
  }) {
    return {
      number: invoice.number,
      totalMinor: invoice.totalMinor,
      dueAmountMinor: invoice.dueAmountMinor,
      dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
    };
  }

  private async loadInvoiceForNotification(invoiceId: string) {
    return this.prisma.client.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: {
          select: { userId: true, phone: true, email: true, fullName: true },
        },
      },
    });
  }

  private async safeEnqueue(
    tenantId: string,
    recipient: { userId?: string; email?: string; phone?: string },
    channels: NotificationChannel[],
    template: string,
    data: Record<string, unknown>,
    idempotencyKey?: string,
  ): Promise<void> {
    try {
      await this.notifications.enqueue(tenantId, recipient, channels, {
        template,
        data,
        idempotencyKey,
      });
    } catch (err) {
      this.logger.warn({ err, template }, 'Notification enqueue failed');
    }
  }
}
