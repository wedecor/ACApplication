import { createHmac, timingSafeEqual } from 'node:crypto';

import type { AuthPrincipal } from '@ac/auth';
import type { LoadedServerEnv } from '@ac/config';
import { InvoiceStatus } from '@ac/types';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { APP_CONFIG } from '../../common/config/config.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { PaymentsService } from '../payments/payments.service';
import type { ConfirmMyInvoicePaymentDto, PayMyInvoiceDto } from './dto/me-payments.dto';
import { type AppInvoiceStatus,toAppInvoiceStatus } from './me.mappers';
import { MeContextService } from './me-context.service';

/** Deep link the hosted checkout returns to (see customer-app lib/payments.ts). */
export const PAYMENT_RETURN_URL = 'acplatform://pay/return';
const PDF_LINK_TTL_SECONDS = 15 * 60;

/** Statuses the customer never sees (staff still editing). */
const HIDDEN_INVOICE_STATUSES = [InvoiceStatus.DRAFT];

const NOT_PAYABLE = new Set<string>([
  InvoiceStatus.PAID,
  InvoiceStatus.CANCELLED,
  InvoiceStatus.REFUNDED,
  InvoiceStatus.DRAFT,
]);

// ------------------------------------------------------------ pdf links

/**
 * Signed, short-lived download link for an invoice PDF. Lets the app open
 * the PDF in the system browser (which cannot send our bearer token)
 * without making invoices publicly enumerable.
 */
export function signInvoicePdf(secret: string, invoiceId: string, tenantId: string, exp: number): string {
  return createHmac('sha256', `invoice-pdf:${secret}`).update(`${invoiceId}.${tenantId}.${exp}`).digest('hex');
}

export function verifyInvoicePdfSignature(
  secret: string,
  invoiceId: string,
  tenantId: string,
  exp: number,
  sig: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!Number.isFinite(exp) || exp < nowSeconds) return false;
  const expected = Buffer.from(signInvoicePdf(secret, invoiceId, tenantId, exp), 'hex');
  const given = Buffer.from(sig, 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export interface InvoiceSummaryView {
  id: string;
  number: string;
  status: AppInvoiceStatus;
  amountMinor: number;
  dueMinor: number;
  paidMinor: number;
  currency: string;
  dueAt: string | null;
  issuedAt: string;
  bookingId: string | null;
  amcSubscriptionId: string | null;
  pdfUrl: string | null;
}

@Injectable()
export class MeInvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: MeContextService,
    private readonly invoices: InvoicesService,
    private readonly payments: PaymentsService,
    @Inject(APP_CONFIG) private readonly env: LoadedServerEnv,
  ) {}

  async list(actor: AuthPrincipal): Promise<InvoiceSummaryView[]> {
    const customer = await this.ctx.requireCustomer(actor);
    const rows = await this.prisma.client.invoice.findMany({
      where: {
        tenantId: actor.tenantId,
        customerId: customer.id,
        deletedAt: null,
        status: { notIn: HIDDEN_INVOICE_STATUSES },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => this.toSummary(r, actor.tenantId));
  }

  async detail(actor: AuthPrincipal, id: string) {
    const invoice = await this.owned(actor, id);
    const lineItems = invoice.lineItems.map((l) => ({
      label: l.quantity > 1 ? `${l.description} × ${l.quantity}` : l.description,
      amountMinor: l.totalMinor,
    }));
    if (invoice.discountMinor > 0) {
      lineItems.push({ label: 'Discount', amountMinor: -invoice.discountMinor });
    }
    const summary = this.toSummary(invoice, actor.tenantId);
    return {
      ...summary,
      subtotalMinor: invoice.subtotalMinor,
      taxMinor: invoice.taxMinor,
      discountMinor: invoice.discountMinor,
      lineItems,
      pdfUrl: summary.pdfUrl ?? this.pdfLink(invoice.id, actor.tenantId),
    };
  }

  /** Starts a hosted checkout via the shared payment-link flow. */
  async pay(actor: AuthPrincipal, id: string, dto: PayMyInvoiceDto) {
    const customer = await this.ctx.requireCustomer(actor);
    const invoice = await this.owned(actor, id);
    if (NOT_PAYABLE.has(invoice.status) || invoice.dueAmountMinor <= 0) {
      throw new ConflictException('This invoice is not payable');
    }
    if (dto.methodId) {
      const method = await this.prisma.client.savedPaymentMethod.findFirst({
        where: { id: dto.methodId, tenantId: actor.tenantId, customerId: customer.id, deletedAt: null },
        select: { id: true, gateway: true },
      });
      if (!method) throw new BadRequestException('Unknown payment method');
      if (method.gateway !== dto.gateway) {
        throw new BadRequestException('Payment method belongs to a different gateway');
      }
    }

    const { transaction, hostedLink } = await this.payments.createPaymentLink(actor, {
      invoiceId: invoice.id,
      provider: dto.gateway,
      callbackUrl: PAYMENT_RETURN_URL,
    });
    return {
      gateway: dto.gateway,
      orderId: transaction.orderRef ?? transaction.id,
      transactionId: transaction.id,
      // Razorpay key id is the *publishable* identifier, safe for clients.
      key: dto.gateway === 'razorpay' ? (this.env.RAZORPAY_KEY_ID ?? '') : '',
      amountMinor: transaction.amountMinor,
      currency: transaction.currency,
      checkoutUrl: hostedLink,
    };
  }

  /**
   * Post-checkout confirmation. The gateway webhook is the source of truth
   * (it applies the payment); this simply reports the invoice's current
   * state so the app can update immediately.
   */
  async confirm(actor: AuthPrincipal, id: string, dto: ConfirmMyInvoicePaymentDto) {
    const customer = await this.ctx.requireCustomer(actor);
    const invoice = await this.owned(actor, id);
    if (dto.transactionId) {
      const txn = await this.prisma.client.paymentTransaction.findFirst({
        where: { id: dto.transactionId, invoiceId: id, customerId: customer.id, tenantId: actor.tenantId },
        select: { id: true },
      });
      if (!txn) throw new NotFoundException('Payment attempt not found');
    }
    const status = toAppInvoiceStatus(invoice.status);
    return {
      status,
      dueMinor: invoice.dueAmountMinor,
      receiptUrl: status === 'PAID' ? (invoice.pdfUrl ?? this.pdfLink(invoice.id, actor.tenantId)) : undefined,
    };
  }

  /** Renders the PDF for a signed link (route is @Public; the signature is the auth). */
  async renderSignedPdf(id: string, tenantId: string, exp: number, sig: string) {
    if (!verifyInvoicePdfSignature(this.env.JWT_SECRET, id, tenantId, exp, sig)) {
      throw new ForbiddenException('Link expired or invalid');
    }
    // InvoicesService only reads `tenantId` from the principal for scoping.
    const principal = { tenantId } as AuthPrincipal;
    return this.invoices.renderPdf(principal, id);
  }

  pdfLink(invoiceId: string, tenantId: string): string {
    const exp = Math.floor(Date.now() / 1000) + PDF_LINK_TTL_SECONDS;
    const sig = signInvoicePdf(this.env.JWT_SECRET, invoiceId, tenantId, exp);
    const base = this.env.API_URL.replace(/\/$/, '');
    const qs = new URLSearchParams({ t: tenantId, exp: String(exp), sig });
    return `${base}/api/v1/me/invoices/${invoiceId}/pdf?${qs.toString()}`;
  }

  private toSummary(
    r: {
      id: string;
      number: string;
      status: string;
      totalMinor: number;
      dueAmountMinor: number;
      amountPaidMinor: number;
      currency: string;
      dueDate: Date | null;
      issueDate: Date | null;
      createdAt: Date;
      bookingId: string | null;
      amcSubscriptionId: string | null;
      pdfUrl: string | null;
    },
    tenantId: string,
  ): InvoiceSummaryView {
    return {
      id: r.id,
      number: r.number,
      status: toAppInvoiceStatus(r.status),
      amountMinor: r.totalMinor,
      dueMinor: r.dueAmountMinor,
      paidMinor: r.amountPaidMinor,
      currency: r.currency,
      dueAt: r.dueDate?.toISOString() ?? null,
      issuedAt: (r.issueDate ?? r.createdAt).toISOString(),
      bookingId: r.bookingId,
      amcSubscriptionId: r.amcSubscriptionId,
      pdfUrl: r.pdfUrl ?? this.pdfLink(r.id, tenantId),
    };
  }

  private async owned(actor: AuthPrincipal, id: string) {
    const customer = await this.ctx.requireCustomer(actor);
    const invoice = await this.prisma.client.invoice.findFirst({
      where: {
        id,
        tenantId: actor.tenantId,
        customerId: customer.id,
        deletedAt: null,
        status: { notIn: HIDDEN_INVOICE_STATUSES },
      },
      include: { lineItems: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }
}
