/**
 * GST / tax calculator.
 *
 * Indian GST splits into CGST + SGST (intra-state) or IGST (inter-state).
 * Determining the split needs:
 *   1. The supplier's state (us)
 *   2. The customer's `placeOfSupply` (a 2-letter state code)
 *
 * If both states match → CGST + SGST (each at rate / 2).
 * Otherwise → IGST at the full rate.
 *
 * Computation is always done on the **post-discount line subtotal** and
 * uses banker's rounding to satisfy GST council guidance.
 */

import { applyBps, ensureInteger, roundHalfEven, subtractFloorZero } from './money';

export interface LineItemInput {
  quantity: number;
  unitPriceMinor: number;
  discountMinor?: number;
  taxRateBps: number;
}

export interface LineItemTax {
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  cgstMinor: number;
  sgstMinor: number;
  igstMinor: number;
}

export interface InvoiceTotals {
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  cgstMinor: number;
  sgstMinor: number;
  igstMinor: number;
}

export interface GstContext {
  /** When false → the entire invoice is non-taxable (taxMinor === 0). */
  gstEnabled: boolean;
  /** Supplier state code (e.g. "KA"). Defaults to env-provided home state. */
  supplierState: string;
  /** Customer's place of supply. When null → treat as inter-state. */
  placeOfSupply: string | null;
}

const HOME_STATE = (process.env.GST_HOME_STATE ?? 'KA').toUpperCase();

export function defaultGstContext(overrides: Partial<GstContext> = {}): GstContext {
  return {
    gstEnabled: overrides.gstEnabled ?? true,
    supplierState: (overrides.supplierState ?? HOME_STATE).toUpperCase(),
    placeOfSupply: overrides.placeOfSupply ? overrides.placeOfSupply.toUpperCase() : null,
  };
}

export function isIntraState(ctx: GstContext): boolean {
  if (!ctx.placeOfSupply) return false;
  return ctx.placeOfSupply.toUpperCase() === ctx.supplierState.toUpperCase();
}

export function computeLineTax(line: LineItemInput, ctx: GstContext): LineItemTax {
  ensureInteger(line.quantity, 'line.quantity');
  ensureInteger(line.unitPriceMinor, 'line.unitPriceMinor');
  if (line.quantity <= 0) throw new Error('quantity must be > 0');

  const gross = line.quantity * line.unitPriceMinor;
  const discount = ensureInteger(line.discountMinor ?? 0, 'line.discount');
  const subtotal = subtractFloorZero(gross, discount);

  if (!ctx.gstEnabled || line.taxRateBps <= 0) {
    return {
      subtotalMinor: subtotal,
      taxMinor: 0,
      totalMinor: subtotal,
      cgstMinor: 0,
      sgstMinor: 0,
      igstMinor: 0,
    };
  }

  const taxTotal = applyBps(subtotal, line.taxRateBps);
  if (isIntraState(ctx)) {
    // CGST + SGST split — each is rate/2. Re-derive each side to avoid
    // 1-paise drift introduced by halving the total.
    const halfBps = Math.floor(line.taxRateBps / 2);
    const cgst = applyBps(subtotal, halfBps);
    const sgst = taxTotal - cgst;
    return {
      subtotalMinor: subtotal,
      taxMinor: taxTotal,
      totalMinor: subtotal + taxTotal,
      cgstMinor: cgst,
      sgstMinor: sgst,
      igstMinor: 0,
    };
  }
  return {
    subtotalMinor: subtotal,
    taxMinor: taxTotal,
    totalMinor: subtotal + taxTotal,
    cgstMinor: 0,
    sgstMinor: 0,
    igstMinor: taxTotal,
  };
}

export function computeInvoiceTotals(
  lines: readonly LineItemInput[],
  ctx: GstContext,
  invoiceDiscountMinor = 0,
): { lines: LineItemTax[]; totals: InvoiceTotals } {
  const lineTaxes = lines.map((l) => computeLineTax(l, ctx));
  const lineSubtotal = lineTaxes.reduce((s, l) => s + l.subtotalMinor, 0);
  const lineTax = lineTaxes.reduce((s, l) => s + l.taxMinor, 0);
  const cgst = lineTaxes.reduce((s, l) => s + l.cgstMinor, 0);
  const sgst = lineTaxes.reduce((s, l) => s + l.sgstMinor, 0);
  const igst = lineTaxes.reduce((s, l) => s + l.igstMinor, 0);

  // Invoice-level discount applies on the post-tax total — typical for ops
  // discounts ("good-will gesture") that shouldn't change GST liability.
  const discount = ensureInteger(invoiceDiscountMinor);
  const grandPreDiscount = lineSubtotal + lineTax;
  const total = subtractFloorZero(grandPreDiscount, discount);

  return {
    lines: lineTaxes,
    totals: {
      subtotalMinor: lineSubtotal,
      discountMinor: Math.min(discount, grandPreDiscount),
      taxMinor: lineTax,
      totalMinor: total,
      cgstMinor: cgst,
      sgstMinor: sgst,
      igstMinor: igst,
    },
  };
}

/** Helper for AMC / payouts that just need a flat rate without lines. */
export function flatTax(baseMinor: number, taxRateBps: number): number {
  return applyBps(baseMinor, taxRateBps);
}

export { roundHalfEven };
