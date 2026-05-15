/**
 * Invoice service — the heart of the finance module.
 *
 * Responsibilities
 *  • Generate invoices from bookings or ad-hoc line items
 *  • Compute totals with GST line-by-line (CGST + SGST vs IGST)
 *  • Persist atomically with a tenant-scoped sequential number
 *  • Track partial payments, refund pipeline, credit notes
 *  • Emit domain events for every state change (notifications + realtime)
 *  • Render branded PDFs and persist their tamper-evident hash
 *
 * Concurrency model
 *  • Mutation paths run in a Postgres serializable transaction
 *  • Recompute helper recalculates totals from the canonical line items;
 *    UI never gets the chance to pre-compute incorrect numbers
 *  • `dueAmountMinor` is denormalised so reports avoid SUM() scans
 */

import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  CreditNoteStatus,
  DomainEventName,
  InvoiceStatus,
  LedgerEntryDirection,
  LedgerEntryType,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
} from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { PrismaService } from '../../common/prisma/prisma.service';
import { DomainEventBus } from '../../common/events/domain-event-bus.service';
import {
  computeInvoiceTotals,
  defaultGstContext,
  ensureInteger,
  nextDocumentNumber,
} from '../../common/finance';
import { LedgerService } from '../ledger/ledger.service';
import { PdfService } from '../pdf/pdf.service';
import type {
  CreateInvoiceDto,
  CreateInvoiceLineItemDto,
} from './dto/create-invoice.dto';
import type { ListInvoicesDto } from './dto/list-invoices.dto';
import type { UpdateInvoiceDto } from './dto/update-invoice.dto';
import type { RecordPaymentDto } from './dto/record-payment.dto';
import type { RefundInvoiceDto } from './dto/refund-invoice.dto';

const EDITABLE_STATUSES = new Set<InvoiceStatus>([InvoiceStatus.DRAFT]);
const TERMINAL_STATUSES = new Set<InvoiceStatus>([
  InvoiceStatus.CANCELLED,
  InvoiceStatus.REFUNDED,
]);

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly events: DomainEventBus,
    private readonly pdf: PdfService,
  ) {}

  // ------------------------------------------------------------------- create
  async create(actor: AuthPrincipal, dto: CreateInvoiceDto) {
    if (!dto.lineItems?.length) throw new BadRequestException('At least one line item required');

    const customer = await this.prisma.client.customer.findFirst({
      where: { id: dto.customerId, tenantId: actor.tenantId },
      select: { id: true, fullName: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    if (dto.bookingId) {
      const booking = await this.prisma.client.booking.findFirst({
        where: { id: dto.bookingId, tenantId: actor.tenantId },
        select: { id: true, invoice: { select: { id: true } } },
      });
      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.invoice) {
        throw new ConflictException(`Booking already has invoice ${booking.invoice.id}`);
      }
    }

    const ctx = defaultGstContext({
      gstEnabled: dto.gstEnabled ?? true,
      placeOfSupply: dto.placeOfSupply ?? null,
    });
    const computed = computeInvoiceTotals(
      dto.lineItems.map(this.toLineInput),
      ctx,
      dto.discountMinor ?? 0,
    );

    const number = await nextDocumentNumber(this.prisma, actor.tenantId, {
      prefix: 'INV',
      table: 'invoice',
    });

    const invoice = await this.prisma.client.invoice.create({
      data: {
        tenantId: actor.tenantId,
        number,
        bookingId: dto.bookingId ?? null,
        amcSubscriptionId: dto.amcSubscriptionId ?? null,
        customerId: dto.customerId,
        status: InvoiceStatus.DRAFT,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        subtotalMinor: computed.totals.subtotalMinor,
        discountMinor: computed.totals.discountMinor,
        taxMinor: computed.totals.taxMinor,
        totalMinor: computed.totals.totalMinor,
        dueAmountMinor: computed.totals.totalMinor,
        currency: dto.currency ?? 'INR',
        gstEnabled: ctx.gstEnabled,
        gstNumber: dto.gstNumber ?? null,
        placeOfSupply: ctx.placeOfSupply,
        notes: dto.notes ?? null,
        terms: dto.terms ?? null,
        generatedBy: actor.userId,
        lineItems: {
          create: dto.lineItems.map((line, idx) => {
            const c = computed.lines[idx]!;
            return {
              description: line.description,
              quantity: line.quantity,
              unitPriceMinor: line.unitPriceMinor,
              discountMinor: line.discountMinor ?? 0,
              taxRateBps: line.taxRateBps ?? 0,
              hsnSacCode: line.hsnSacCode ?? null,
              subtotalMinor: c.subtotalMinor,
              taxMinor: c.taxMinor,
              totalMinor: c.totalMinor,
              cgstMinor: c.cgstMinor,
              sgstMinor: c.sgstMinor,
              igstMinor: c.igstMinor,
            };
          }),
        },
      },
      include: { lineItems: true },
    });

    this.events.publish(DomainEventName.InvoiceCreated, {
      invoiceId: invoice.id,
      customerId: invoice.customerId,
      totalMinor: invoice.totalMinor,
      bookingId: invoice.bookingId,
    } as never);
    return invoice;
  }

  /**
   * Convenience helper used by the AMC scheduler & booking-completion
   * listener — keeps invoice creation atomic with the upstream change.
   */
  async createFromLineItems(
    actor: AuthPrincipal,
    customerId: string,
    lineItems: CreateInvoiceLineItemDto[],
    options: {
      bookingId?: string | null;
      amcSubscriptionId?: string | null;
      gstEnabled?: boolean;
      placeOfSupply?: string | null;
      dueDate?: Date | null;
      notes?: string | null;
      currency?: string;
    } = {},
  ) {
    return this.create(actor, {
      customerId,
      bookingId: options.bookingId ?? undefined,
      amcSubscriptionId: options.amcSubscriptionId ?? undefined,
      lineItems,
      gstEnabled: options.gstEnabled,
      placeOfSupply: options.placeOfSupply ?? undefined,
      dueDate: options.dueDate ? options.dueDate.toISOString() : undefined,
      notes: options.notes ?? undefined,
      currency: options.currency,
    });
  }

  // ------------------------------------------------------------------- list
  async list(actor: AuthPrincipal, dto: ListInvoicesDto) {
    const where: Prisma.InvoiceWhereInput = { tenantId: actor.tenantId };
    if (dto.status) where.status = dto.status;
    if (dto.customerId) where.customerId = dto.customerId;
    if (dto.bookingId) where.bookingId = dto.bookingId;
    if (dto.minDueAmountMinor) where.dueAmountMinor = { gte: dto.minDueAmountMinor };
    if (dto.overdueOnly) {
      where.dueDate = { lt: new Date() };
      where.dueAmountMinor = { ...(where.dueAmountMinor as object | undefined), gt: 0 } as
        | number
        | Prisma.IntFilter<'Invoice'>;
      where.status = { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID] };
    }
    if (dto.q) {
      where.OR = [
        { number: { contains: dto.q, mode: 'insensitive' } },
        { notes: { contains: dto.q, mode: 'insensitive' } },
      ];
    }
    const [total, items] = await Promise.all([
      this.prisma.client.invoice.count({ where }),
      this.prisma.client.invoice.findMany({
        where,
        skip: dto.skip,
        take: dto.pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          lineItems: true,
          customer: { select: { id: true, fullName: true, phone: true, email: true } },
        },
      }),
    ]);
    return { items, total, page: dto.page, pageSize: dto.pageSize };
  }

  // ------------------------------------------------------------------ getOne
  async get(actor: AuthPrincipal, id: string) {
    const invoice = await this.prisma.client.invoice.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        lineItems: true,
        payments: { orderBy: { createdAt: 'desc' } },
        refunds: { orderBy: { createdAt: 'desc' } },
        creditNotes: true,
        customer: { select: { id: true, fullName: true, phone: true, email: true } },
        booking: {
          select: { id: true, scheduledAt: true, status: true, technicianId: true },
        },
        amcSubscription: { select: { id: true, number: true, planId: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  // ------------------------------------------------------------------ update
  async update(actor: AuthPrincipal, id: string, dto: UpdateInvoiceDto) {
    return this.prisma.client.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id, tenantId: actor.tenantId },
        include: { lineItems: true },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (!EDITABLE_STATUSES.has(invoice.status as InvoiceStatus)) {
        // Allow soft fields after issue
        const safeUpdate: Prisma.InvoiceUpdateInput = {};
        if (dto.notes !== undefined) safeUpdate.notes = dto.notes;
        if (dto.dueDate !== undefined) safeUpdate.dueDate = new Date(dto.dueDate);
        if (Object.keys(safeUpdate).length === 0) {
          throw new ForbiddenException(
            `Invoice ${invoice.number} is ${invoice.status}; only notes / dueDate may change`,
          );
        }
        return tx.invoice.update({ where: { id }, data: safeUpdate, include: { lineItems: true } });
      }

      // DRAFT → full recompute if line items / discount changed
      const lineItems = dto.lineItems ?? invoice.lineItems.map(this.fromStoredLine);
      const ctx = defaultGstContext({
        gstEnabled: dto.gstEnabled ?? invoice.gstEnabled,
        placeOfSupply: dto.placeOfSupply ?? invoice.placeOfSupply ?? null,
      });
      const computed = computeInvoiceTotals(
        lineItems.map(this.toLineInput),
        ctx,
        dto.discountMinor ?? invoice.discountMinor,
      );

      if (dto.lineItems) {
        await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
        await tx.invoiceLineItem.createMany({
          data: dto.lineItems.map((line, idx) => {
            const c = computed.lines[idx]!;
            return {
              invoiceId: id,
              description: line.description,
              quantity: line.quantity,
              unitPriceMinor: line.unitPriceMinor,
              discountMinor: line.discountMinor ?? 0,
              taxRateBps: line.taxRateBps ?? 0,
              hsnSacCode: line.hsnSacCode ?? null,
              subtotalMinor: c.subtotalMinor,
              taxMinor: c.taxMinor,
              totalMinor: c.totalMinor,
              cgstMinor: c.cgstMinor,
              sgstMinor: c.sgstMinor,
              igstMinor: c.igstMinor,
            };
          }),
        });
      }

      return tx.invoice.update({
        where: { id },
        data: {
          subtotalMinor: computed.totals.subtotalMinor,
          discountMinor: computed.totals.discountMinor,
          taxMinor: computed.totals.taxMinor,
          totalMinor: computed.totals.totalMinor,
          dueAmountMinor: computed.totals.totalMinor - invoice.amountPaidMinor,
          gstEnabled: ctx.gstEnabled,
          gstNumber: dto.gstNumber ?? invoice.gstNumber,
          placeOfSupply: ctx.placeOfSupply,
          notes: dto.notes ?? invoice.notes,
          terms: dto.terms ?? invoice.terms,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : invoice.dueDate,
        },
        include: { lineItems: true },
      });
    });
  }

  // -------------------------------------------------------------------- send
  async send(actor: AuthPrincipal, id: string) {
    return this.prisma.client.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id, tenantId: actor.tenantId },
        select: { id: true, status: true, customerId: true, totalMinor: true, number: true },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.status !== InvoiceStatus.DRAFT) {
        throw new ConflictException(`Cannot send an invoice in ${invoice.status} state`);
      }

      const updated = await tx.invoice.update({
        where: { id },
        data: {
          status: InvoiceStatus.SENT,
          issueDate: new Date(),
          sentAt: new Date(),
        },
      });
      await this.ledger.post(
        {
          tenantId: actor.tenantId,
          customerId: invoice.customerId,
          entryType: LedgerEntryType.INVOICE,
          direction: LedgerEntryDirection.DEBIT,
          amountMinor: invoice.totalMinor,
          description: `Invoice ${invoice.number}`,
          invoiceId: invoice.id,
          externalRef: `invoice:${invoice.id}:issued`,
        },
        tx,
      );
      this.events.publish(DomainEventName.InvoiceSent, {
        invoiceId: invoice.id,
        customerId: invoice.customerId,
      } as never);
      return updated;
    });
  }

  // ------------------------------------------------------------------ cancel
  async cancel(actor: AuthPrincipal, id: string, reason?: string) {
    return this.prisma.client.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id, tenantId: actor.tenantId },
        include: { lineItems: true },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (TERMINAL_STATUSES.has(invoice.status as InvoiceStatus)) {
        throw new ConflictException('Already in a terminal state');
      }
      if (invoice.amountPaidMinor > 0) {
        throw new ConflictException(
          'Cannot cancel — refund payments first then cancel the invoice',
        );
      }
      const updated = await tx.invoice.update({
        where: { id },
        data: {
          status: InvoiceStatus.CANCELLED,
          cancelledAt: new Date(),
          dueAmountMinor: 0,
          notes: reason ? `${invoice.notes ?? ''}\n[Cancelled] ${reason}`.trim() : invoice.notes,
        },
      });
      if (invoice.status !== InvoiceStatus.DRAFT) {
        await this.ledger.post(
          {
            tenantId: actor.tenantId,
            customerId: invoice.customerId,
            entryType: LedgerEntryType.ADJUSTMENT,
            direction: LedgerEntryDirection.CREDIT,
            amountMinor: invoice.totalMinor,
            description: `Cancel invoice ${invoice.number}`,
            invoiceId: invoice.id,
            externalRef: `invoice:${invoice.id}:cancel`,
          },
          tx,
        );
      }
      this.events.publish(DomainEventName.InvoiceCancelled, {
        invoiceId: invoice.id,
        reason: reason ?? null,
      } as never);
      return updated;
    });
  }

  // -------------------------------------------------------- record / settle
  /**
   * Apply a payment (manual cash, post-webhook gateway, etc.) to an invoice.
   * Idempotent: passing a `paymentTransactionId` we've already booked is
   * silently skipped so webhook retries don't double-credit.
   */
  async applyPayment(
    invoiceId: string,
    input: {
      tenantId: string;
      amountMinor: number;
      method: PaymentMethod;
      gatewayRef?: string | null;
      transactionId?: string | null;
      idempotencyKey?: string | null;
      capturedAt?: Date;
    },
  ) {
    ensureInteger(input.amountMinor, 'amountMinor');
    if (input.amountMinor <= 0) throw new BadRequestException('amountMinor must be > 0');

    return this.prisma.client.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, tenantId: input.tenantId },
        select: {
          id: true,
          status: true,
          totalMinor: true,
          amountPaidMinor: true,
          dueAmountMinor: true,
          customerId: true,
          number: true,
        },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (TERMINAL_STATUSES.has(invoice.status as InvoiceStatus)) {
        throw new ConflictException('Cannot settle a closed invoice');
      }

      if (input.transactionId) {
        const dup = await tx.payment.findUnique({
          where: { transactionId: input.transactionId },
          select: { id: true },
        });
        if (dup) {
          this.logger.warn(
            `Skipping duplicate payment application for transaction ${input.transactionId}`,
          );
          return tx.invoice.findUniqueOrThrow({
            where: { id: invoiceId },
            include: { payments: true },
          });
        }
      }

      const applyAmount = Math.min(input.amountMinor, invoice.dueAmountMinor);
      if (applyAmount <= 0) {
        throw new ConflictException('Invoice has no outstanding balance');
      }

      await tx.payment.create({
        data: {
          tenantId: input.tenantId,
          invoiceId: invoice.id,
          method: input.method,
          status: PaymentStatus.CAPTURED,
          amountMinor: applyAmount,
          currency: 'INR',
          gatewayRef: input.gatewayRef ?? null,
          transactionId: input.transactionId ?? null,
          capturedAt: input.capturedAt ?? new Date(),
        },
      });

      const newPaid = invoice.amountPaidMinor + applyAmount;
      const newDue = Math.max(0, invoice.totalMinor - newPaid);
      const newStatus =
        newDue === 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

      const updated = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaidMinor: newPaid,
          dueAmountMinor: newDue,
          status: newStatus,
          paidAt: newStatus === InvoiceStatus.PAID ? new Date() : null,
        },
      });

      await this.ledger.post(
        {
          tenantId: input.tenantId,
          customerId: invoice.customerId,
          entryType: LedgerEntryType.PAYMENT,
          direction: LedgerEntryDirection.CREDIT,
          amountMinor: applyAmount,
          description: `Payment for invoice ${invoice.number}`,
          invoiceId: invoice.id,
          externalRef: input.transactionId
            ? `payment:tx:${input.transactionId}`
            : `payment:${invoice.id}:${Date.now()}`,
        },
        tx,
      );

      if (newStatus === InvoiceStatus.PAID) {
        this.events.publish(DomainEventName.InvoicePaid, {
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          paidAmountMinor: newPaid,
        } as never);
      } else {
        this.events.publish(DomainEventName.InvoicePartiallyPaid, {
          invoiceId: invoice.id,
          amountPaidMinor: newPaid,
          dueAmountMinor: newDue,
        } as never);
      }
      return updated;
    });
  }

  /** Manual payment recorded by ops (cash, bank transfer outside gateway). */
  async recordManualPayment(actor: AuthPrincipal, invoiceId: string, dto: RecordPaymentDto) {
    return this.applyPayment(invoiceId, {
      tenantId: actor.tenantId,
      amountMinor: dto.amountMinor,
      method: dto.method,
      gatewayRef: dto.gatewayRef ?? null,
      idempotencyKey: `manual:${actor.userId}:${invoiceId}:${Date.now()}`,
    });
  }

  // ------------------------------------------------------------------ refund
  async refund(actor: AuthPrincipal, invoiceId: string, dto: RefundInvoiceDto) {
    return this.prisma.client.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, tenantId: actor.tenantId },
        include: { payments: { where: { status: PaymentStatus.CAPTURED } } },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');

      const payment = dto.paymentId
        ? invoice.payments.find((p) => p.id === dto.paymentId)
        : invoice.payments[0];
      if (!payment) throw new BadRequestException('No settled payment available to refund');

      const alreadyRefunded = await tx.refund.aggregate({
        where: {
          paymentId: payment.id,
          status: { in: [RefundStatus.COMPLETED, RefundStatus.PROCESSING] },
        },
        _sum: { amountMinor: true },
      });
      const refundableOnPayment =
        payment.amountMinor - (alreadyRefunded._sum.amountMinor ?? 0);
      if (dto.amountMinor > refundableOnPayment) {
        throw new BadRequestException(
          `Refund exceeds remaining refundable amount on payment ${payment.id}`,
        );
      }

      const issueCN = dto.issueCreditNote ?? true;
      let creditNote: { id: string; number: string } | null = null;
      if (issueCN) {
        const number = await nextDocumentNumber(this.prisma, actor.tenantId, {
          prefix: 'CN',
          table: 'creditNote',
        });
        const created = await tx.creditNote.create({
          data: {
            tenantId: actor.tenantId,
            number,
            customerId: invoice.customerId,
            invoiceId: invoice.id,
            status: CreditNoteStatus.ISSUED,
            amountMinor: dto.amountMinor,
            currency: invoice.currency,
            reason: dto.reason ?? null,
            issuedAt: new Date(),
          },
          select: { id: true, number: true },
        });
        creditNote = created;
        this.events.publish(DomainEventName.CreditNoteIssued, {
          creditNoteId: created.id,
          customerId: invoice.customerId,
          amountMinor: dto.amountMinor,
        } as never);
      }

      const refund = await tx.refund.create({
        data: {
          tenantId: actor.tenantId,
          paymentId: payment.id,
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          amountMinor: dto.amountMinor,
          status: RefundStatus.PROCESSING,
          reason: dto.reason ?? null,
          requestedBy: actor.userId,
          creditNoteId: creditNote?.id ?? null,
        },
      });

      // Status & balance updates
      const newRefunded = invoice.amountRefundedMinor + dto.amountMinor;
      const newStatus =
        newRefunded >= invoice.amountPaidMinor ? InvoiceStatus.REFUNDED : invoice.status;
      const updated = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountRefundedMinor: newRefunded,
          status: newStatus,
          // Refunds re-open the dueAmount conceptually but typically with a credit note
          dueAmountMinor:
            newStatus === InvoiceStatus.REFUNDED ? 0 : invoice.dueAmountMinor,
        },
      });

      await this.ledger.post(
        {
          tenantId: actor.tenantId,
          customerId: invoice.customerId,
          entryType: LedgerEntryType.REFUND,
          direction: LedgerEntryDirection.DEBIT,
          amountMinor: dto.amountMinor,
          description: `Refund for invoice ${invoice.number}`,
          invoiceId: invoice.id,
          refundId: refund.id,
          creditNoteId: creditNote?.id ?? null,
          externalRef: `refund:${refund.id}`,
        },
        tx,
      );

      this.events.publish(DomainEventName.InvoiceRefunded, {
        invoiceId: invoice.id,
        refundId: refund.id,
        amountMinor: dto.amountMinor,
      } as never);

      return { invoice: updated, refund, creditNote };
    });
  }

  // ------------------------------------------------------------------ duplicate
  async duplicate(actor: AuthPrincipal, invoiceId: string) {
    const src = await this.get(actor, invoiceId);
    return this.create(actor, {
      customerId: src.customerId,
      lineItems: src.lineItems.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPriceMinor: l.unitPriceMinor,
        discountMinor: l.discountMinor,
        taxRateBps: l.taxRateBps,
        hsnSacCode: l.hsnSacCode ?? undefined,
      })),
      discountMinor: src.discountMinor,
      gstEnabled: src.gstEnabled,
      gstNumber: src.gstNumber ?? undefined,
      placeOfSupply: src.placeOfSupply ?? undefined,
      notes: src.notes ?? undefined,
      terms: src.terms ?? undefined,
      currency: src.currency,
    });
  }

  // ---------------------------------------------------------------------- pdf
  async renderPdf(actor: AuthPrincipal, invoiceId: string) {
    const invoice = await this.get(actor, invoiceId);
    const customer = invoice.customer;
    const result = await this.pdf.invoice({
      invoice: {
        number: invoice.number,
        status: invoice.status,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        currency: invoice.currency,
        subtotalMinor: invoice.subtotalMinor,
        discountMinor: invoice.discountMinor,
        taxMinor: invoice.taxMinor,
        cgstMinor: invoice.lineItems.reduce((s, l) => s + l.cgstMinor, 0),
        sgstMinor: invoice.lineItems.reduce((s, l) => s + l.sgstMinor, 0),
        igstMinor: invoice.lineItems.reduce((s, l) => s + l.igstMinor, 0),
        totalMinor: invoice.totalMinor,
        amountPaidMinor: invoice.amountPaidMinor,
        dueAmountMinor: invoice.dueAmountMinor,
        notes: invoice.notes,
        terms: invoice.terms,
        placeOfSupply: invoice.placeOfSupply,
        gstEnabled: invoice.gstEnabled,
        gstNumber: invoice.gstNumber,
      },
      customer: {
        name: customer.fullName,
        email: customer.email,
        phone: customer.phone,
        address: null,
        gstin: invoice.gstNumber,
      },
      lines: invoice.lineItems.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPriceMinor: l.unitPriceMinor,
        discountMinor: l.discountMinor,
        taxRateBps: l.taxRateBps,
        hsnSacCode: l.hsnSacCode,
        subtotalMinor: l.subtotalMinor,
        taxMinor: l.taxMinor,
        totalMinor: l.totalMinor,
      })),
      qrPayload: invoice.dueAmountMinor > 0 ? `upi://pay?am=${invoice.dueAmountMinor / 100}&tr=${invoice.number}` : null,
    });

    await this.prisma.client.invoice.update({
      where: { id: invoice.id },
      data: { pdfHash: result.hash },
    });
    return result;
  }

  // ---------------------------------------------------------------- internal
  private toLineInput = (line: CreateInvoiceLineItemDto) => ({
    quantity: line.quantity,
    unitPriceMinor: line.unitPriceMinor,
    discountMinor: line.discountMinor ?? 0,
    taxRateBps: line.taxRateBps ?? 0,
  });

  private fromStoredLine = (l: {
    description: string;
    quantity: number;
    unitPriceMinor: number;
    discountMinor: number;
    taxRateBps: number;
    hsnSacCode: string | null;
  }): CreateInvoiceLineItemDto => ({
    description: l.description,
    quantity: l.quantity,
    unitPriceMinor: l.unitPriceMinor,
    discountMinor: l.discountMinor,
    taxRateBps: l.taxRateBps,
    hsnSacCode: l.hsnSacCode ?? undefined,
  });

  /** Used internally by reports — generates a stable short token for QR payloads. */
  static linkToken(): string {
    return randomBytes(12).toString('base64url');
  }
}
