import type { AuthPrincipal } from '@ac/auth';
import { Permission } from '@ac/types';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../../common/prisma/prisma.service';
import type { CreateInvoiceLineItemDto } from '../../invoices/dto/create-invoice.dto';
import { InvoicesService } from '../../invoices/invoices.service';
import { PaymentsService } from '../../payments/payments.service';
import { QuotationsService } from '../../quotations/quotations.service';
import { isFieldTechnician } from '../domain/access';
import { RepairAccessService } from '../repair-access.service';
import { RecordFieldPaymentDto } from './dto/field-billing.dto';

/** What a staff member (non field-technician) needs for each operation. */
export const FIELD_BILLING_STAFF_PERMISSIONS = {
  view: [Permission.INVOICE_VIEW],
  invoice: [Permission.BOOKING_READ, Permission.INVOICE_CREATE],
  payment: [Permission.BOOKING_READ, Permission.PAYMENT_MANAGE],
  paymentLink: [Permission.BOOKING_READ, Permission.PAYMENT_MANAGE],
  quotation: [Permission.BOOKING_READ, Permission.QUOTATION_SEND],
} as const satisfies Record<string, readonly Permission[]>;
export type FieldBillingOperation = keyof typeof FIELD_BILLING_STAFF_PERMISSIONS;

const INVOICEABLE_BOOKING_STATUSES = new Set(['IN_PROGRESS', 'COMPLETED']);
const OPEN_LINK_STATUSES = ['CREATED', 'PENDING'] as const;

export interface FieldBillingSummary {
  invoice: {
    id: string;
    number: string;
    status: string;
    totalMinor: number;
    amountPaidMinor: number;
    dueAmountMinor: number;
    currency: string;
  } | null;
  quotation: {
    id: string;
    number: string;
    status: string;
    totalMinor: number;
    viewToken?: string;
  } | null;
  payments: { id: string; amountMinor: number; method: string; status: string; createdAt: Date }[];
  paymentLink: { id: string; url: string; status: string } | null;
}

/**
 * Technician-scoped billing for a single booking: amount due, on-site
 * invoice, cash/UPI/card collection, payment links and quotation sending.
 *
 * Access (enforced here because the route guard is ALL-of, and this needs
 * ANY-of): a field technician must hold JOBCARD_WRITE *and* be assigned to
 * the booking; anyone else must hold the staff permissions for the operation.
 */
@Injectable()
export class FieldBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: RepairAccessService,
    private readonly invoices: InvoicesService,
    private readonly payments: PaymentsService,
    private readonly quotations: QuotationsService,
  ) {}

  async summary(actor: AuthPrincipal, bookingId: string): Promise<FieldBillingSummary> {
    await this.loadBooking(actor, bookingId, 'view');
    return this.buildSummary(actor.tenantId, bookingId);
  }

  async createInvoice(actor: AuthPrincipal, bookingId: string): Promise<FieldBillingSummary> {
    const booking = await this.loadBooking(actor, bookingId, 'invoice');
    if (booking.invoice) return this.buildSummary(actor.tenantId, bookingId);
    if (!INVOICEABLE_BOOKING_STATUSES.has(booking.status)) {
      throw new ConflictException(
        `An invoice can only be raised while the booking is IN_PROGRESS or COMPLETED (is ${booking.status})`,
      );
    }

    try {
      if (booking.quotation?.status === 'APPROVED') {
        await this.quotations.convertToInvoice(actor, booking.quotation.id);
      } else {
        const lineItems = buildInvoiceLines(booking);
        if (!lineItems.length) {
          throw new BadRequestException({
            message: booking.isWarrantyRevisit
              ? 'Warranty revisits are zero-charge — nothing to invoice'
              : 'Booking has no amount to invoice; set a final amount or catalog item first',
            code: 'NOTHING_TO_INVOICE',
          });
        }
        await this.invoices.createFromLineItems(actor, booking.customerId, lineItems, {
          bookingId: booking.id,
          notes: `Field invoice for booking ${booking.code}`,
        });
      }
      // The technician hands this invoice to the customer on-site, so issue it now
      // (posts the ledger DEBIT before any payment is collected against it).
      const raised = await this.prisma.client.invoice.findFirst({
        where: { bookingId, tenantId: actor.tenantId, status: 'DRAFT' },
        select: { id: true },
      });
      if (raised) await this.invoices.send(actor, raised.id);
    } catch (err) {
      // Lost a race with a concurrent request — the invoice exists now, which is what we want.
      if (!(err instanceof ConflictException)) throw err;
      const exists = await this.prisma.client.invoice.findFirst({
        where: { bookingId, tenantId: actor.tenantId },
        select: { id: true },
      });
      if (!exists) throw err;
    }
    return this.buildSummary(actor.tenantId, bookingId);
  }

  async recordPayment(
    actor: AuthPrincipal,
    bookingId: string,
    dto: RecordFieldPaymentDto,
  ): Promise<FieldBillingSummary> {
    const booking = await this.loadBooking(actor, bookingId, 'payment');
    const invoice = this.requireInvoice(booking);
    if (invoice.dueAmountMinor <= 0) throw new ConflictException('Invoice is already settled');
    if (dto.amountMinor > invoice.dueAmountMinor) {
      throw new BadRequestException({
        message: `amountMinor exceeds the amount due (${invoice.dueAmountMinor})`,
        code: 'AMOUNT_EXCEEDS_DUE',
        dueAmountMinor: invoice.dueAmountMinor,
      });
    }
    await this.invoices.applyPayment(invoice.id, {
      tenantId: actor.tenantId,
      amountMinor: dto.amountMinor,
      method: dto.method,
      gatewayRef: dto.reference?.trim() || null,
      idempotencyKey: `field:${actor.userId}:${invoice.id}:${Date.now()}`,
    });
    return this.buildSummary(actor.tenantId, bookingId);
  }

  async paymentLink(actor: AuthPrincipal, bookingId: string): Promise<{ id: string; url: string; status: string }> {
    const booking = await this.loadBooking(actor, bookingId, 'paymentLink');
    const invoice = this.requireInvoice(booking);
    if (invoice.dueAmountMinor <= 0) throw new ConflictException('Invoice is already settled');

    const existing = await this.prisma.client.paymentTransaction.findFirst({
      where: {
        tenantId: actor.tenantId,
        invoiceId: invoice.id,
        status: { in: [...OPEN_LINK_STATUSES] },
        hostedLink: { not: null },
        amountMinor: invoice.dueAmountMinor,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, hostedLink: true, status: true },
    });
    if (existing?.hostedLink) {
      return { id: existing.id, url: existing.hostedLink, status: existing.status };
    }

    const created = await this.payments.createPaymentLink(actor, { invoiceId: invoice.id });
    return {
      id: created.transaction.id,
      url: created.hostedLink ?? '',
      status: created.transaction.status,
    };
  }

  async sendQuotation(actor: AuthPrincipal, bookingId: string) {
    const booking = await this.loadBooking(actor, bookingId, 'quotation');
    if (!booking.quotation) throw new NotFoundException('Booking has no quotation');
    const q =
      booking.quotation.status === 'DRAFT'
        ? await this.quotations.send(actor, booking.quotation.id)
        : booking.quotation;
    if (q.status !== 'SENT' && q.status !== 'VIEWED' && q.status !== 'APPROVED') {
      throw new ConflictException(`Cannot send a quotation in ${q.status} state`);
    }
    return {
      id: q.id,
      number: q.number,
      status: q.status,
      totalMinor: q.totalMinor,
      viewToken: q.viewToken,
    };
  }

  // ---------------------------------------------------------------- helpers

  /** Any-of access check: assigned field technician with JOBCARD_WRITE, or staff with the op's permissions. */
  async assertAccess(
    actor: AuthPrincipal,
    booking: { technicianId: string | null },
    op: FieldBillingOperation,
  ): Promise<void> {
    const perms = new Set<string>(actor.permissions ?? []);
    if (isFieldTechnician(actor)) {
      if (!perms.has(Permission.JOBCARD_WRITE)) {
        throw new ForbiddenException('Missing permission jobcard:write');
      }
      await this.access.assertBookingAccess(actor, booking);
      return;
    }
    const required = FIELD_BILLING_STAFF_PERMISSIONS[op];
    const missing = required.filter((p) => !perms.has(p));
    if (missing.length) {
      throw new ForbiddenException(`Missing permission(s): ${missing.join(', ')}`);
    }
  }

  private async loadBooking(actor: AuthPrincipal, bookingId: string, op: FieldBillingOperation) {
    const booking = await this.prisma.client.booking.findFirst({
      where: { id: bookingId, tenantId: actor.tenantId },
      select: {
        id: true,
        code: true,
        status: true,
        customerId: true,
        technicianId: true,
        category: true,
        serviceType: true,
        isWarrantyRevisit: true,
        finalAmountMinor: true,
        estimatedAmountMinor: true,
        catalogItem: {
          select: { name: true, basePriceMinor: true, visitChargeMinor: true, gstRateBps: true, sacCode: true },
        },
        invoice: {
          select: { id: true, number: true, status: true, totalMinor: true, amountPaidMinor: true, dueAmountMinor: true, currency: true },
        },
        quotation: {
          select: { id: true, number: true, status: true, totalMinor: true, viewToken: true },
        },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    await this.assertAccess(actor, booking, op);
    return booking;
  }

  private requireInvoice<T extends { invoice: { id: string; dueAmountMinor: number } | null }>(booking: T) {
    if (!booking.invoice) {
      throw new ConflictException({ message: 'Raise an invoice first', code: 'NO_INVOICE' });
    }
    return booking.invoice;
  }

  private async buildSummary(tenantId: string, bookingId: string): Promise<FieldBillingSummary> {
    const [invoice, quotation] = await Promise.all([
      this.prisma.client.invoice.findFirst({
        where: { bookingId, tenantId },
        select: {
          id: true,
          number: true,
          status: true,
          totalMinor: true,
          amountPaidMinor: true,
          dueAmountMinor: true,
          currency: true,
        },
      }),
      this.prisma.client.quotation.findFirst({
        where: { bookingId, tenantId },
        select: { id: true, number: true, status: true, totalMinor: true, viewToken: true },
      }),
    ]);
    const [payments, link] = invoice
      ? await Promise.all([
          this.prisma.client.payment.findMany({
            where: { invoiceId: invoice.id, tenantId },
            orderBy: { createdAt: 'desc' },
            select: { id: true, amountMinor: true, method: true, status: true, createdAt: true },
          }),
          this.prisma.client.paymentTransaction.findFirst({
            where: { invoiceId: invoice.id, tenantId, hostedLink: { not: null } },
            orderBy: { createdAt: 'desc' },
            select: { id: true, hostedLink: true, status: true },
          }),
        ])
      : [[], null];
    return {
      invoice,
      quotation,
      payments,
      paymentLink: link?.hostedLink ? { id: link.id, url: link.hostedLink, status: link.status } : null,
    };
  }
}

/**
 * Invoice lines for a booking without an approved quotation:
 *   1. Technician-set final amount (GST-inclusive, single line), else
 *   2. Catalog item base price + visit charge (GST added at the item rate), else
 *   3. The booking estimate (single line).
 * Warranty revisits are zero-charge → no lines.
 */
export function buildInvoiceLines(booking: {
  code: string;
  category: string;
  serviceType: string | null;
  isWarrantyRevisit: boolean;
  finalAmountMinor: number | null;
  estimatedAmountMinor: number;
  catalogItem: {
    name: string;
    basePriceMinor: number;
    visitChargeMinor: number;
    gstRateBps: number;
    sacCode: string | null;
  } | null;
}): CreateInvoiceLineItemDto[] {
  if (booking.isWarrantyRevisit) return [];
  const label = booking.catalogItem?.name ?? booking.serviceType ?? `${booking.category.replace(/_/g, ' ')} service`;
  const sac = booking.catalogItem?.sacCode ?? undefined;

  if (booking.finalAmountMinor != null && booking.finalAmountMinor > 0) {
    return [{ description: label, quantity: 1, unitPriceMinor: booking.finalAmountMinor, taxRateBps: 0, hsnSacCode: sac }];
  }
  const item = booking.catalogItem;
  if (item && item.basePriceMinor + item.visitChargeMinor > 0) {
    const lines: CreateInvoiceLineItemDto[] = [];
    if (item.basePriceMinor > 0) {
      lines.push({ description: item.name, quantity: 1, unitPriceMinor: item.basePriceMinor, taxRateBps: item.gstRateBps, hsnSacCode: sac });
    }
    if (item.visitChargeMinor > 0) {
      lines.push({ description: 'Visit charge', quantity: 1, unitPriceMinor: item.visitChargeMinor, taxRateBps: item.gstRateBps, hsnSacCode: sac });
    }
    return lines;
  }
  if (booking.estimatedAmountMinor > 0) {
    return [{ description: label, quantity: 1, unitPriceMinor: booking.estimatedAmountMinor, taxRateBps: 0, hsnSacCode: sac }];
  }
  return [];
}
