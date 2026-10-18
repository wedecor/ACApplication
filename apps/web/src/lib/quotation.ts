/** Customer-facing quotation helpers for the public approval page. Pure, so unit-tested. */

export type PublicQuotationStatus =
  | 'SENT'
  | 'VIEWED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CONVERTED';

export interface PublicQuotation {
  number: string;
  status: PublicQuotationStatus;
  expiresAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  currency: string;
  gstEnabled: boolean;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  notes: string | null;
  terms: string | null;
  customerFirstName: string | null;
  bookingCode: string | null;
  lineItems: {
    description: string;
    quantity: number;
    unitPriceMinor: number;
    discountMinor: number;
    taxRateBps: number;
    totalMinor: number;
  }[];
}

/** Paise → "₹1,180" (drops ".00", keeps real paise). */
export function formatMinorINR(minor: number): string {
  const rupees = minor / 100;
  return rupees.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export type QuotationStage = 'awaiting' | 'expired' | 'approved' | 'declined';

/** Where the customer stands: can they still decide, or is it settled? */
export function quotationStage(q: Pick<PublicQuotation, 'status' | 'expiresAt'>, now = new Date()): QuotationStage {
  if (q.status === 'APPROVED' || q.status === 'CONVERTED') return 'approved';
  if (q.status === 'REJECTED') return 'declined';
  if (q.status === 'EXPIRED' || new Date(q.expiresAt).getTime() < now.getTime()) return 'expired';
  return 'awaiting';
}

export function formatQuoteDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
