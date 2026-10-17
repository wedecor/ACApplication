/**
 * On-site quotation maths. Mirrors the server's `computeInvoiceTotals`
 * (apps/api/src/common/finance/gst.ts) so the total the technician shows
 * the customer matches the quotation the API stores:
 *   line subtotal = max(0, qty × unit − discount)
 *   line tax      = roundHalfEven(subtotal × bps / 10 000)   (0 when GST off)
 *
 * Pure — unit-tested in `__tests__/quote-math.test.ts`.
 */

export type QuoteLineKind = 'CATALOG' | 'PART' | 'LABOUR' | 'VISIT';

export interface QuoteLine {
  /** Client-side key (stable within a draft). */
  key: string;
  kind: QuoteLineKind;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  discountMinor: number;
  /** Basis points; 1800 = 18 %. */
  taxRateBps: number;
  /** Catalog item id / inventory item id, for traceability. */
  refId?: string;
  /** For PART lines: how many the van actually has. */
  maxQuantity?: number;
  hsnSacCode?: string;
}

export interface QuoteLineTotals {
  key: string;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
}

export interface QuoteTotals {
  lines: QuoteLineTotals[];
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
}

export function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

export function applyBps(baseMinor: number, bps: number): number {
  if (!Number.isFinite(bps) || bps <= 0) return 0;
  return roundHalfEven((baseMinor * bps) / 10_000);
}

export function computeQuoteTotals(lines: readonly QuoteLine[], gstEnabled = true): QuoteTotals {
  const out: QuoteLineTotals[] = lines.map((l) => {
    const qty = Math.max(0, Math.floor(l.quantity));
    const gross = qty * Math.max(0, Math.round(l.unitPriceMinor));
    const subtotal = Math.max(0, gross - Math.max(0, Math.round(l.discountMinor)));
    const tax = gstEnabled ? applyBps(subtotal, l.taxRateBps) : 0;
    return { key: l.key, subtotalMinor: subtotal, taxMinor: tax, totalMinor: subtotal + tax };
  });
  const discountMinor = lines.reduce((s, l) => {
    const gross = Math.max(0, Math.floor(l.quantity)) * Math.max(0, Math.round(l.unitPriceMinor));
    return s + Math.min(gross, Math.max(0, Math.round(l.discountMinor)));
  }, 0);
  return {
    lines: out,
    subtotalMinor: out.reduce((s, l) => s + l.subtotalMinor, 0),
    discountMinor,
    taxMinor: out.reduce((s, l) => s + l.taxMinor, 0),
    totalMinor: out.reduce((s, l) => s + l.totalMinor, 0),
  };
}

/** Returns human-readable problems; empty array means the quote can be sent. */
export function validateQuoteLines(lines: readonly QuoteLine[]): string[] {
  const errors: string[] = [];
  if (lines.length === 0) errors.push('Add at least one line item.');
  for (const l of lines) {
    const name = l.description.trim() || 'Untitled line';
    if (!l.description.trim()) errors.push('Every line needs a description.');
    if (!Number.isInteger(l.quantity) || l.quantity < 1) {
      errors.push(`${name}: quantity must be a whole number ≥ 1.`);
    }
    if (l.maxQuantity != null && l.quantity > l.maxQuantity) {
      errors.push(`${name}: only ${l.maxQuantity} in your van.`);
    }
    if (!Number.isInteger(l.unitPriceMinor) || l.unitPriceMinor < 0) {
      errors.push(`${name}: price must be ≥ 0.`);
    }
    if (l.discountMinor > l.quantity * l.unitPriceMinor) {
      errors.push(`${name}: discount exceeds line value.`);
    }
  }
  return Array.from(new Set(errors));
}

/** Shape expected by `CreateInvoiceLineItemDto` (quotations reuse it). */
export interface QuotationLineItemInput {
  description: string;
  quantity: number;
  unitPriceMinor: number;
  discountMinor?: number;
  taxRateBps?: number;
  hsnSacCode?: string;
}

const KIND_PREFIX: Record<QuoteLineKind, string> = {
  CATALOG: '',
  PART: 'Part: ',
  LABOUR: 'Labour: ',
  VISIT: '',
};

export function toQuotationLineItems(lines: readonly QuoteLine[]): QuotationLineItemInput[] {
  return lines.map((l) => {
    const prefix = KIND_PREFIX[l.kind];
    const base = l.description.trim();
    const description = (base.startsWith(prefix) ? base : `${prefix}${base}`).slice(0, 255);
    return {
      description,
      quantity: l.quantity,
      unitPriceMinor: l.unitPriceMinor,
      ...(l.discountMinor > 0 ? { discountMinor: l.discountMinor } : {}),
      ...(l.taxRateBps > 0 ? { taxRateBps: l.taxRateBps } : {}),
      ...(l.hsnSacCode ? { hsnSacCode: l.hsnSacCode } : {}),
    };
  });
}

/** Add a line, or bump quantity when the same catalog/part is added twice. */
export function upsertQuoteLine(lines: readonly QuoteLine[], next: QuoteLine): QuoteLine[] {
  if (next.refId && (next.kind === 'CATALOG' || next.kind === 'PART')) {
    const idx = lines.findIndex((l) => l.kind === next.kind && l.refId === next.refId);
    if (idx >= 0) {
      return lines.map((l, i) => {
        if (i !== idx) return l;
        const quantity = l.quantity + next.quantity;
        return { ...l, quantity: l.maxQuantity != null ? Math.min(quantity, l.maxQuantity) : quantity };
      });
    }
  }
  return [...lines, next];
}
