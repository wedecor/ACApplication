/**
 * Quotation service.
 *
 * The estimate workflow mirrors the invoice engine but with one extra
 * twist: the customer must be able to view a quotation via a public
 * `viewToken` URL. Viewing flips `status` from SENT → VIEWED automatically
 * (great signal for sales). Approval / rejection by the customer transitions
 * into APPROVED / REJECTED; the ops team can then `convertToInvoice` in one
 * click — which creates the invoice and links the two records.
 *
 * Expiry is handled by a cron in the SLA-like financial sweep.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { DomainEventName, QuotationStatus, TERMINAL_QUOTATION_STATUSES } from '@ac/types';
import type { AuthPrincipal } from '@ac/auth';

import { PrismaService } from '../../common/prisma/prisma.service';
import { DomainEventBus } from '../../common/events/domain-event-bus.service';
import {
  computeInvoiceTotals,
  defaultGstContext,
  nextDocumentNumber,
} from '../../common/finance';
import { InvoicesService } from '../invoices/invoices.service';
import { PdfService } from '../pdf/pdf.service';
import type { CreateQuotationDto } from './dto/create-quotation.dto';
import type { ListQuotationsDto } from './dto/list-quotations.dto';

const DEFAULT_EXPIRY_DAYS = 7;

@Injectable()
export class QuotationsService {
  private readonly logger = new Logger(QuotationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventBus,
    private readonly invoices: InvoicesService,
    private readonly pdf: PdfService,
  ) {}

  async create(actor: AuthPrincipal, dto: CreateQuotationDto) {
    const customer = await this.prisma.client.customer.findFirst({
      where: { id: dto.customerId, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const ctx = defaultGstContext({
      gstEnabled: dto.gstEnabled ?? true,
      placeOfSupply: dto.placeOfSupply ?? null,
    });
    const computed = computeInvoiceTotals(
      dto.lineItems.map((l) => ({
        quantity: l.quantity,
        unitPriceMinor: l.unitPriceMinor,
        discountMinor: l.discountMinor ?? 0,
        taxRateBps: l.taxRateBps ?? 0,
      })),
      ctx,
      0,
    );

    const number = await nextDocumentNumber(this.prisma, actor.tenantId, {
      prefix: 'QTN',
      table: 'quotation',
    });

    const expiresAt = dto.expiresAt
      ? new Date(dto.expiresAt)
      : new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 3600 * 1000);

    const created = await this.prisma.client.quotation.create({
      data: {
        tenantId: actor.tenantId,
        number,
        customerId: dto.customerId,
        bookingId: dto.bookingId ?? null,
        leadId: dto.leadId ?? null,
        status: QuotationStatus.DRAFT,
        expiresAt,
        subtotalMinor: computed.totals.subtotalMinor,
        taxMinor: computed.totals.taxMinor,
        totalMinor: computed.totals.totalMinor,
        gstEnabled: ctx.gstEnabled,
        notes: dto.notes ?? null,
        terms: dto.terms ?? null,
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
            };
          }),
        },
      },
      include: { lineItems: true },
    });

    this.events.publish(DomainEventName.QuotationCreated, {
      quotationId: created.id,
      customerId: created.customerId,
    } as never);
    return created;
  }

  async list(actor: AuthPrincipal, dto: ListQuotationsDto) {
    const where: Prisma.QuotationWhereInput = { tenantId: actor.tenantId };
    if (dto.status) where.status = dto.status;
    if (dto.customerId) where.customerId = dto.customerId;
    if (dto.q) where.OR = [{ number: { contains: dto.q, mode: 'insensitive' } }];
    const [total, items] = await Promise.all([
      this.prisma.client.quotation.count({ where }),
      this.prisma.client.quotation.findMany({
        where,
        skip: dto.skip,
        take: dto.pageSize,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { id: true, fullName: true } } },
      }),
    ]);
    return { items, total, page: dto.page, pageSize: dto.pageSize };
  }

  async get(actor: AuthPrincipal, id: string) {
    const q = await this.prisma.client.quotation.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: { lineItems: true, customer: true },
    });
    if (!q) throw new NotFoundException('Quotation not found');
    return q;
  }

  async send(actor: AuthPrincipal, id: string) {
    const q = await this.get(actor, id);
    if (q.status !== QuotationStatus.DRAFT) {
      throw new ConflictException(`Cannot send a quotation in ${q.status} state`);
    }
    const updated = await this.prisma.client.quotation.update({
      where: { id },
      data: { status: QuotationStatus.SENT, sentAt: new Date() },
    });
    this.events.publish(DomainEventName.QuotationSent, {
      quotationId: id,
      customerId: q.customerId,
    } as never);
    return updated;
  }

  /** Public lookup — used by the customer landing page (no auth). */
  async getByViewToken(viewToken: string) {
    const q = await this.prisma.client.quotation.findFirst({
      where: { viewToken },
      include: { lineItems: true, customer: { select: { fullName: true, email: true } } },
    });
    if (!q) throw new NotFoundException('Quotation not found');

    // Auto-bump SENT → VIEWED so sales sees an engagement signal.
    if (q.status === QuotationStatus.SENT) {
      await this.prisma.client.quotation.update({
        where: { id: q.id },
        data: { status: QuotationStatus.VIEWED, viewedAt: new Date() },
      });
      this.events.publish(DomainEventName.QuotationViewed, {
        quotationId: q.id,
        viewedAt: new Date().toISOString(),
      } as never);
    }
    return q;
  }

  async customerApprove(viewToken: string) {
    const q = await this.prisma.client.quotation.findFirst({ where: { viewToken } });
    if (!q) throw new NotFoundException('Quotation not found');
    if (TERMINAL_QUOTATION_STATUSES.has(q.status as QuotationStatus)) {
      throw new ConflictException('Quotation is in a terminal state');
    }
    if (q.expiresAt < new Date()) {
      throw new ForbiddenException('Quotation has expired');
    }
    const updated = await this.prisma.client.quotation.update({
      where: { id: q.id },
      data: { status: QuotationStatus.APPROVED, approvedAt: new Date() },
    });
    this.events.publish(DomainEventName.QuotationApproved, {
      quotationId: q.id,
      customerId: q.customerId,
    } as never);
    return updated;
  }

  async customerReject(viewToken: string, reason?: string) {
    const q = await this.prisma.client.quotation.findFirst({ where: { viewToken } });
    if (!q) throw new NotFoundException('Quotation not found');
    if (TERMINAL_QUOTATION_STATUSES.has(q.status as QuotationStatus)) {
      throw new ConflictException('Quotation is in a terminal state');
    }
    const updated = await this.prisma.client.quotation.update({
      where: { id: q.id },
      data: {
        status: QuotationStatus.REJECTED,
        rejectedAt: new Date(),
        rejectedReason: reason ?? null,
      },
    });
    this.events.publish(DomainEventName.QuotationRejected, {
      quotationId: q.id,
      reason: reason ?? null,
    } as never);
    return updated;
  }

  async convertToInvoice(actor: AuthPrincipal, id: string) {
    const q = await this.get(actor, id);
    if (q.status === QuotationStatus.CONVERTED) {
      throw new ConflictException('Already converted');
    }
    if (q.status !== QuotationStatus.APPROVED && q.status !== QuotationStatus.VIEWED) {
      throw new BadRequestException('Only APPROVED / VIEWED quotations can be converted');
    }

    const invoice = await this.invoices.create(actor, {
      customerId: q.customerId,
      bookingId: q.bookingId ?? undefined,
      lineItems: q.lineItems.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPriceMinor: l.unitPriceMinor,
        discountMinor: l.discountMinor,
        taxRateBps: l.taxRateBps,
        hsnSacCode: l.hsnSacCode ?? undefined,
      })),
      gstEnabled: q.gstEnabled,
      notes: q.notes ?? undefined,
      terms: q.terms ?? undefined,
    });

    await this.prisma.client.quotation.update({
      where: { id },
      data: {
        status: QuotationStatus.CONVERTED,
        convertedAt: new Date(),
        convertedInvoiceId: invoice.id,
      },
    });
    this.events.publish(DomainEventName.QuotationConverted, {
      quotationId: id,
      invoiceId: invoice.id,
    } as never);
    return invoice;
  }

  /**
   * Background sweep — flips SENT/VIEWED quotations to EXPIRED when their
   * deadline passes. Idempotent.
   */
  async expireOverdue(): Promise<number> {
    const expired = await this.prisma.client.quotation.updateMany({
      where: {
        status: { in: [QuotationStatus.SENT, QuotationStatus.VIEWED] },
        expiresAt: { lt: new Date() },
      },
      data: { status: QuotationStatus.EXPIRED },
    });
    if (expired.count > 0) {
      this.logger.log(`Expired ${expired.count} stale quotations`);
    }
    return expired.count;
  }

  async renderPdf(actor: AuthPrincipal, id: string) {
    const q = await this.get(actor, id);
    return this.pdf.quotation({
      quotation: {
        number: q.number,
        status: q.status,
        expiresAt: q.expiresAt,
        currency: q.currency,
        subtotalMinor: q.subtotalMinor,
        discountMinor: q.discountMinor,
        taxMinor: q.taxMinor,
        totalMinor: q.totalMinor,
        notes: q.notes,
        terms: q.terms,
      },
      customer: { name: q.customer.fullName, email: q.customer.email, phone: q.customer.phone },
      lines: q.lineItems.map((l) => ({
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
      qrPayload: `${process.env.WEB_BASE_URL ?? 'https://app.ac-platform.io'}/q/${q.viewToken}`,
    });
  }
}
