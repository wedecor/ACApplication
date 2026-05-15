/**
 * PDF generation engine for finance documents.
 *
 * Wraps pdfkit with a small layout system tailored to invoice / quotation /
 * receipt / AMC contract templates. Each renderer is small, focused, and
 * shares one `pageHeader` / `pageFooter` so brand updates land everywhere.
 *
 * Returns the rendered PDF as a `Buffer` *and* its SHA-256 hash, so the
 * caller can persist `pdfHash` for tamper detection.
 */

import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';

import { formatMinor } from '../../common/finance';
import { PDF_BRAND, PDF_FONTS, type PdfBrand } from './pdf.tokens';

export interface PdfResult {
  buffer: Buffer;
  /** SHA-256 hash of the PDF bytes (hex). Persisted as `pdfHash`. */
  hash: string;
}

export interface InvoiceLineRow {
  description: string;
  quantity: number;
  unitPriceMinor: number;
  discountMinor?: number;
  taxRateBps?: number;
  hsnSacCode?: string | null;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
}

export interface InvoicePdfInput {
  brand?: Partial<PdfBrand>;
  invoice: {
    number: string;
    status: string;
    issueDate: Date | null;
    dueDate: Date | null;
    currency: string;
    subtotalMinor: number;
    discountMinor: number;
    taxMinor: number;
    cgstMinor: number;
    sgstMinor: number;
    igstMinor: number;
    totalMinor: number;
    amountPaidMinor: number;
    dueAmountMinor: number;
    notes: string | null;
    terms: string | null;
    placeOfSupply: string | null;
    gstEnabled: boolean;
    gstNumber: string | null;
  };
  customer: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    gstin?: string | null;
  };
  lines: InvoiceLineRow[];
  /** Encoded into a QR code on the invoice — typically a payment-link URL. */
  qrPayload?: string | null;
  /** Optional translation table — keys = field names, values = translations. */
  i18n?: Record<string, string>;
}

export interface ReceiptPdfInput {
  brand?: Partial<PdfBrand>;
  receipt: {
    number: string;
    paidAt: Date;
    method: string;
    gatewayRef: string | null;
    amountMinor: number;
    currency: string;
  };
  customer: { name: string; email?: string | null };
  invoice: { number: string; totalMinor: number; dueAmountMinor: number };
}

export interface QuotationPdfInput {
  brand?: Partial<PdfBrand>;
  quotation: {
    number: string;
    status: string;
    expiresAt: Date;
    currency: string;
    subtotalMinor: number;
    discountMinor: number;
    taxMinor: number;
    totalMinor: number;
    notes: string | null;
    terms: string | null;
  };
  customer: { name: string; email?: string | null; phone?: string | null };
  lines: InvoiceLineRow[];
  qrPayload?: string | null;
}

export interface AmcContractPdfInput {
  brand?: Partial<PdfBrand>;
  subscription: {
    number: string;
    startsAt: Date;
    endsAt: Date;
    priceMinor: number;
    currency: string;
    visitsScheduled: number;
    autoRenew: boolean;
  };
  plan: {
    name: string;
    type: string;
    includedVisits: number;
    description: string | null;
    features: string[];
    emergencySupport: boolean;
    prioritySupport: boolean;
  };
  customer: { name: string; email?: string | null; phone?: string | null; address?: string | null };
}

const MARGIN = 50;

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async invoice(input: InvoicePdfInput): Promise<PdfResult> {
    return this.render(async (doc, brand) => {
      this.pageHeader(doc, brand, input.i18n?.title ?? 'TAX INVOICE');

      this.metaRow(doc, [
        ['Invoice #', input.invoice.number],
        ['Status', input.invoice.status],
        [
          'Issue date',
          input.invoice.issueDate ? fmtDate(input.invoice.issueDate) : 'Pending issue',
        ],
        ['Due date', input.invoice.dueDate ? fmtDate(input.invoice.dueDate) : '—'],
      ]);

      this.partyBlock(doc, 'Billed to', {
        name: input.customer.name,
        lines: [
          input.customer.email ?? '',
          input.customer.phone ?? '',
          input.customer.address ?? '',
          input.customer.gstin ? `GSTIN: ${input.customer.gstin}` : '',
        ].filter(Boolean),
      });

      if (input.qrPayload) {
        await this.drawQrCode(doc, input.qrPayload, doc.page.width - MARGIN - 90, doc.y - 80, 80);
      }

      doc.moveDown(1);
      this.lineItemsTable(doc, input.lines, input.invoice.currency, input.invoice.gstEnabled);

      this.totalsBlock(doc, {
        rows: [
          ['Subtotal', formatMinor(input.invoice.subtotalMinor, { currency: input.invoice.currency })],
          input.invoice.discountMinor > 0
            ? [
                'Discount',
                `− ${formatMinor(input.invoice.discountMinor, { currency: input.invoice.currency })}`,
              ]
            : null,
          input.invoice.cgstMinor > 0
            ? ['CGST', formatMinor(input.invoice.cgstMinor, { currency: input.invoice.currency })]
            : null,
          input.invoice.sgstMinor > 0
            ? ['SGST', formatMinor(input.invoice.sgstMinor, { currency: input.invoice.currency })]
            : null,
          input.invoice.igstMinor > 0
            ? ['IGST', formatMinor(input.invoice.igstMinor, { currency: input.invoice.currency })]
            : null,
          input.invoice.taxMinor > 0 &&
          input.invoice.cgstMinor + input.invoice.sgstMinor + input.invoice.igstMinor === 0
            ? ['Tax', formatMinor(input.invoice.taxMinor, { currency: input.invoice.currency })]
            : null,
        ].filter((row): row is [string, string] => row !== null),
        totalLabel: 'Total',
        totalValue: formatMinor(input.invoice.totalMinor, { currency: input.invoice.currency }),
        secondary: [
          [
            'Paid',
            formatMinor(input.invoice.amountPaidMinor, { currency: input.invoice.currency }),
          ],
          ['Due', formatMinor(input.invoice.dueAmountMinor, { currency: input.invoice.currency })],
        ],
      });

      if (input.invoice.placeOfSupply) {
        doc.moveDown(0.4);
        doc
          .fontSize(8)
          .fillColor(brand.mutedColor)
          .text(`Place of supply: ${input.invoice.placeOfSupply}`, MARGIN);
      }

      this.notesBlock(doc, input.invoice.notes, input.invoice.terms);
      this.pageFooter(doc, brand);
    }, input.brand);
  }

  async receipt(input: ReceiptPdfInput): Promise<PdfResult> {
    return this.render((doc, brand) => {
      this.pageHeader(doc, brand, 'PAYMENT RECEIPT');
      this.metaRow(doc, [
        ['Receipt #', input.receipt.number],
        ['Paid at', fmtDateTime(input.receipt.paidAt)],
        ['Method', input.receipt.method],
        ['Gateway ref', input.receipt.gatewayRef ?? '—'],
      ]);

      this.partyBlock(doc, 'Received from', {
        name: input.customer.name,
        lines: [input.customer.email ?? ''].filter(Boolean),
      });

      doc.moveDown(1);
      doc
        .fontSize(11)
        .fillColor(brand.accentColor)
        .font(PDF_FONTS.base)
        .text(`Towards invoice ${input.invoice.number}`, MARGIN);
      doc.moveDown(0.5);

      this.totalsBlock(doc, {
        rows: [
          [
            'Amount received',
            formatMinor(input.receipt.amountMinor, { currency: input.receipt.currency }),
          ],
          [
            'Invoice total',
            formatMinor(input.invoice.totalMinor, { currency: input.receipt.currency }),
          ],
        ],
        totalLabel: 'Outstanding',
        totalValue: formatMinor(input.invoice.dueAmountMinor, {
          currency: input.receipt.currency,
        }),
      });

      this.pageFooter(doc, brand);
    }, input.brand);
  }

  async quotation(input: QuotationPdfInput): Promise<PdfResult> {
    return this.render(async (doc, brand) => {
      this.pageHeader(doc, brand, 'QUOTATION');
      this.metaRow(doc, [
        ['Quotation #', input.quotation.number],
        ['Status', input.quotation.status],
        ['Valid until', fmtDate(input.quotation.expiresAt)],
      ]);
      this.partyBlock(doc, 'Quote for', {
        name: input.customer.name,
        lines: [input.customer.email ?? '', input.customer.phone ?? ''].filter(Boolean),
      });

      if (input.qrPayload) {
        await this.drawQrCode(doc, input.qrPayload, doc.page.width - MARGIN - 90, doc.y - 80, 80);
      }

      doc.moveDown(1);
      this.lineItemsTable(doc, input.lines, input.quotation.currency, false);

      this.totalsBlock(doc, {
        rows: [
          [
            'Subtotal',
            formatMinor(input.quotation.subtotalMinor, { currency: input.quotation.currency }),
          ],
          input.quotation.discountMinor > 0
            ? [
                'Discount',
                `− ${formatMinor(input.quotation.discountMinor, { currency: input.quotation.currency })}`,
              ]
            : null,
          input.quotation.taxMinor > 0
            ? ['Tax', formatMinor(input.quotation.taxMinor, { currency: input.quotation.currency })]
            : null,
        ].filter((row): row is [string, string] => row !== null),
        totalLabel: 'Total',
        totalValue: formatMinor(input.quotation.totalMinor, { currency: input.quotation.currency }),
      });

      this.notesBlock(doc, input.quotation.notes, input.quotation.terms);
      this.pageFooter(doc, brand);
    }, input.brand);
  }

  async amcContract(input: AmcContractPdfInput): Promise<PdfResult> {
    return this.render((doc, brand) => {
      this.pageHeader(doc, brand, 'AMC CONTRACT');
      this.metaRow(doc, [
        ['Contract #', input.subscription.number],
        ['Plan', `${input.plan.name} (${input.plan.type})`],
        ['Starts', fmtDate(input.subscription.startsAt)],
        ['Ends', fmtDate(input.subscription.endsAt)],
      ]);
      this.partyBlock(doc, 'Customer', {
        name: input.customer.name,
        lines: [
          input.customer.email ?? '',
          input.customer.phone ?? '',
          input.customer.address ?? '',
        ].filter(Boolean),
      });

      doc.moveDown(1);
      doc.font(PDF_FONTS.bold).fontSize(11).fillColor(brand.accentColor).text('Plan summary', MARGIN);
      doc.moveDown(0.4);
      doc.font(PDF_FONTS.base).fontSize(10).fillColor(brand.accentColor);
      const summaryLines = [
        input.plan.description ?? '',
        `Included visits: ${input.plan.includedVisits}`,
        `Visits scheduled this cycle: ${input.subscription.visitsScheduled}`,
        input.plan.emergencySupport ? 'Emergency support: yes' : 'Emergency support: no',
        input.plan.prioritySupport ? 'Priority scheduling: yes' : 'Priority scheduling: no',
        input.subscription.autoRenew ? 'Auto-renewal: enabled' : 'Auto-renewal: disabled',
      ].filter(Boolean);
      for (const line of summaryLines) doc.text(`• ${line}`);

      if (input.plan.features.length > 0) {
        doc.moveDown(0.8);
        doc
          .font(PDF_FONTS.bold)
          .fontSize(11)
          .fillColor(brand.accentColor)
          .text('Features', MARGIN);
        doc.moveDown(0.4).font(PDF_FONTS.base).fontSize(10);
        for (const feature of input.plan.features) doc.text(`• ${feature}`);
      }

      doc.moveDown(1);
      this.totalsBlock(doc, {
        rows: [],
        totalLabel: 'Contract value',
        totalValue: formatMinor(input.subscription.priceMinor, {
          currency: input.subscription.currency,
        }),
      });

      this.pageFooter(doc, brand);
    }, input.brand);
  }

  // ------------------------------------------------------------------ helpers
  private async render(
    body: (doc: PDFKit.PDFDocument, brand: PdfBrand) => Promise<void> | void,
    brandOverride?: Partial<PdfBrand>,
  ): Promise<PdfResult> {
    const brand: PdfBrand = { ...PDF_BRAND, ...(brandOverride ?? {}) };
    return new Promise<PdfResult>((resolve, reject) => {
      const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const hash = createHash('sha256').update(buffer).digest('hex');
        resolve({ buffer, hash });
      });
      doc.on('error', reject);
      Promise.resolve(body(doc, brand))
        .then(() => doc.end())
        .catch((err) => {
          this.logger.error('PDF render failed', err);
          doc.end();
          reject(err);
        });
    });
  }

  private pageHeader(doc: PDFKit.PDFDocument, brand: PdfBrand, title: string) {
    const top = MARGIN;
    doc
      .rect(MARGIN, top, doc.page.width - MARGIN * 2, 6)
      .fill(brand.primaryColor);
    doc.fillColor(brand.accentColor);
    doc.font(PDF_FONTS.bold).fontSize(18).text(brand.name, MARGIN, top + 18);
    doc.font(PDF_FONTS.base).fontSize(8).fillColor(brand.mutedColor);
    brand.addressLines.forEach((line, idx) => doc.text(line, MARGIN, top + 40 + idx * 11));
    doc.text(`GSTIN: ${brand.gstin}  |  PAN: ${brand.pan}`, MARGIN, top + 40 + brand.addressLines.length * 11);

    doc
      .font(PDF_FONTS.bold)
      .fontSize(20)
      .fillColor(brand.primaryColor)
      .text(title, MARGIN, top + 18, { align: 'right' });
    doc.font(PDF_FONTS.base).fontSize(8).fillColor(brand.mutedColor);
    doc.text(`${brand.website}  |  ${brand.email}`, MARGIN, top + 44, { align: 'right' });

    doc.y = top + 110;
    doc
      .moveTo(MARGIN, doc.y)
      .lineTo(doc.page.width - MARGIN, doc.y)
      .strokeColor(brand.borderColor)
      .lineWidth(1)
      .stroke();
    doc.moveDown(0.8);
  }

  private metaRow(doc: PDFKit.PDFDocument, items: ReadonlyArray<readonly [string, string]>) {
    const startY = doc.y;
    const colW = (doc.page.width - MARGIN * 2) / items.length;
    items.forEach(([label, value], idx) => {
      const x = MARGIN + colW * idx;
      doc.font(PDF_FONTS.base).fontSize(8).fillColor(PDF_BRAND.mutedColor).text(label.toUpperCase(), x, startY);
      doc.font(PDF_FONTS.bold).fontSize(10).fillColor(PDF_BRAND.accentColor).text(value, x, startY + 12);
    });
    doc.y = startY + 36;
  }

  private partyBlock(
    doc: PDFKit.PDFDocument,
    label: string,
    party: { name: string; lines: string[] },
  ) {
    doc.font(PDF_FONTS.base).fontSize(8).fillColor(PDF_BRAND.mutedColor).text(label.toUpperCase(), MARGIN);
    doc.font(PDF_FONTS.bold).fontSize(12).fillColor(PDF_BRAND.accentColor).text(party.name);
    doc.font(PDF_FONTS.base).fontSize(9).fillColor(PDF_BRAND.mutedColor);
    for (const line of party.lines) doc.text(line);
  }

  private lineItemsTable(
    doc: PDFKit.PDFDocument,
    lines: InvoiceLineRow[],
    currency: string,
    gst: boolean,
  ) {
    const headers: Array<{ label: string; width: number; align: 'left' | 'right' }> = [
      { label: 'Description', width: 220, align: 'left' },
      { label: gst ? 'HSN/SAC' : 'Code', width: 60, align: 'left' },
      { label: 'Qty', width: 35, align: 'right' },
      { label: 'Unit', width: 75, align: 'right' },
      { label: 'Tax', width: 50, align: 'right' },
      { label: 'Total', width: 80, align: 'right' },
    ];
    const tableX = MARGIN;
    const startY = doc.y + 6;
    let cursorX = tableX;

    doc.rect(tableX, startY, doc.page.width - MARGIN * 2, 22).fill(PDF_BRAND.borderColor);
    doc.fillColor(PDF_BRAND.accentColor).font(PDF_FONTS.bold).fontSize(9);
    headers.forEach((h) => {
      doc.text(h.label.toUpperCase(), cursorX + 6, startY + 7, {
        width: h.width - 12,
        align: h.align,
      });
      cursorX += h.width;
    });

    let rowY = startY + 26;
    doc.font(PDF_FONTS.base).fontSize(9).fillColor(PDF_BRAND.accentColor);
    for (const line of lines) {
      cursorX = tableX;
      const cells = [
        line.description,
        line.hsnSacCode ?? '—',
        String(line.quantity),
        formatMinor(line.unitPriceMinor, { currency }),
        line.taxRateBps ? `${(line.taxRateBps / 100).toFixed(2)}%` : '0%',
        formatMinor(line.totalMinor, { currency }),
      ];
      headers.forEach((h, i) => {
        doc.text(cells[i] ?? '', cursorX + 6, rowY, { width: h.width - 12, align: h.align });
        cursorX += h.width;
      });
      rowY += 22;
      doc
        .moveTo(MARGIN, rowY - 4)
        .lineTo(doc.page.width - MARGIN, rowY - 4)
        .strokeColor(PDF_BRAND.borderColor)
        .lineWidth(0.5)
        .stroke();
    }
    doc.y = rowY + 6;
  }

  private totalsBlock(
    doc: PDFKit.PDFDocument,
    block: {
      rows: Array<[string, string]>;
      totalLabel: string;
      totalValue: string;
      secondary?: Array<[string, string]>;
    },
  ) {
    const x = doc.page.width - MARGIN - 220;
    let y = doc.y + 4;
    doc.font(PDF_FONTS.base).fontSize(10).fillColor(PDF_BRAND.accentColor);
    for (const [label, value] of block.rows) {
      doc.fillColor(PDF_BRAND.mutedColor).text(label, x, y, { width: 110 });
      doc.fillColor(PDF_BRAND.accentColor).text(value, x + 110, y, { width: 110, align: 'right' });
      y += 16;
    }
    doc
      .moveTo(x, y + 2)
      .lineTo(x + 220, y + 2)
      .strokeColor(PDF_BRAND.borderColor)
      .stroke();
    y += 6;

    doc.font(PDF_FONTS.bold).fontSize(12).fillColor(PDF_BRAND.primaryColor);
    doc.text(block.totalLabel, x, y, { width: 110 });
    doc.text(block.totalValue, x + 110, y, { width: 110, align: 'right' });
    y += 22;

    if (block.secondary && block.secondary.length > 0) {
      doc.font(PDF_FONTS.base).fontSize(9).fillColor(PDF_BRAND.mutedColor);
      for (const [label, value] of block.secondary) {
        doc.text(label, x, y, { width: 110 });
        doc.fillColor(PDF_BRAND.accentColor).text(value, x + 110, y, { width: 110, align: 'right' });
        doc.fillColor(PDF_BRAND.mutedColor);
        y += 14;
      }
    }
    doc.y = y + 8;
  }

  private notesBlock(doc: PDFKit.PDFDocument, notes?: string | null, terms?: string | null) {
    if (!notes && !terms) return;
    doc.moveDown(0.5);
    doc
      .moveTo(MARGIN, doc.y)
      .lineTo(doc.page.width - MARGIN, doc.y)
      .strokeColor(PDF_BRAND.borderColor)
      .lineWidth(0.5)
      .stroke();
    doc.moveDown(0.4);
    if (notes) {
      doc.font(PDF_FONTS.bold).fontSize(9).fillColor(PDF_BRAND.accentColor).text('Notes', MARGIN);
      doc.font(PDF_FONTS.base).fontSize(9).fillColor(PDF_BRAND.mutedColor).text(notes, { width: 300 });
      doc.moveDown(0.6);
    }
    if (terms) {
      doc.font(PDF_FONTS.bold).fontSize(9).fillColor(PDF_BRAND.accentColor).text('Terms', MARGIN);
      doc
        .font(PDF_FONTS.base)
        .fontSize(8)
        .fillColor(PDF_BRAND.mutedColor)
        .text(terms, { width: 500 });
    }
  }

  private pageFooter(doc: PDFKit.PDFDocument, brand: PdfBrand) {
    const y = doc.page.height - MARGIN - 30;
    doc
      .moveTo(MARGIN, y)
      .lineTo(doc.page.width - MARGIN, y)
      .strokeColor(brand.borderColor)
      .lineWidth(0.5)
      .stroke();
    doc.font(PDF_FONTS.base).fontSize(8).fillColor(brand.mutedColor);
    doc.text(`${brand.legalName} · ${brand.website}`, MARGIN, y + 8, {
      width: doc.page.width - MARGIN * 2,
      align: 'center',
    });
    doc.text(
      'This is a computer-generated document and is valid without a signature.',
      MARGIN,
      y + 20,
      { width: doc.page.width - MARGIN * 2, align: 'center' },
    );
  }

  private async drawQrCode(
    doc: PDFKit.PDFDocument,
    payload: string,
    x: number,
    y: number,
    size: number,
  ) {
    try {
      const dataUrl = await QRCode.toDataURL(payload, { margin: 0, scale: 4 });
      doc.image(dataUrl, x, y, { width: size, height: size });
    } catch (err) {
      this.logger.warn('QR encode failed; skipping', err as Error);
    }
  }
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtDateTime(d: Date): string {
  return d.toISOString().replace('T', ' ').slice(0, 19);
}
