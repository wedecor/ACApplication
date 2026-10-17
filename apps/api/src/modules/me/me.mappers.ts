/**
 * Server → customer-app contract mappers.
 *
 * The customer app (apps/customer-app/src/api/types.ts) deliberately uses a
 * narrower, friendlier vocabulary than the server enums. Every translation
 * lives here as a pure function so it is unit-tested and the controllers
 * never hand-roll string conversions.
 */
import {
  AMCSubscriptionStatus,
  BookingStatus,
  InvoiceStatus,
  ServiceCategory,
} from '@ac/types';

// --------------------------------------------------------------- bookings

export type AppBookingStatus =
  | 'CREATED'
  | 'CONFIRMED'
  | 'ASSIGNED'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'AWAITING_PARTS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

/**
 * Server BookingStatus → app status. `arrived` lets an en-route booking
 * whose technician has checked in (arrivedAt stamped) render as ARRIVED.
 */
export function toAppBookingStatus(status: string, opts: { arrived?: boolean } = {}): AppBookingStatus {
  switch (status) {
    case BookingStatus.DRAFT:
    case BookingStatus.PENDING:
      return 'CREATED';
    case BookingStatus.CONFIRMED:
    case BookingStatus.RESCHEDULED:
      return 'CONFIRMED';
    case BookingStatus.ASSIGNED:
      return 'ASSIGNED';
    case BookingStatus.TECHNICIAN_EN_ROUTE:
      return opts.arrived ? 'ARRIVED' : 'EN_ROUTE';
    case BookingStatus.IN_PROGRESS:
      return 'IN_PROGRESS';
    case BookingStatus.WAITING_PARTS:
      return 'AWAITING_PARTS';
    case BookingStatus.COMPLETED:
      return 'COMPLETED';
    case BookingStatus.CANCELLED:
      return 'CANCELLED';
    case BookingStatus.NO_SHOW:
      return 'NO_SHOW';
    default:
      return 'CREATED';
  }
}

export type AppBookingFilter = 'active' | 'completed' | 'cancelled';

/** App list filter → server statuses. `undefined` = everything except drafts. */
export function serverStatusesForFilter(filter?: AppBookingFilter): BookingStatus[] {
  switch (filter) {
    case 'active':
      return [
        BookingStatus.PENDING,
        BookingStatus.CONFIRMED,
        BookingStatus.ASSIGNED,
        BookingStatus.TECHNICIAN_EN_ROUTE,
        BookingStatus.IN_PROGRESS,
        BookingStatus.WAITING_PARTS,
        BookingStatus.RESCHEDULED,
      ];
    case 'completed':
      return [BookingStatus.COMPLETED];
    case 'cancelled':
      return [BookingStatus.CANCELLED, BookingStatus.NO_SHOW];
    default:
      return (Object.values(BookingStatus) as BookingStatus[]).filter((s) => s !== BookingStatus.DRAFT);
  }
}

/** Statuses a customer may still cancel / reschedule from (before the tech is on the way). */
export const CUSTOMER_MUTABLE_BOOKING_STATUSES: ReadonlySet<string> = new Set([
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.ASSIGNED,
  BookingStatus.RESCHEDULED,
]);

/** Statuses during which the technician's live location is shared with the customer. */
export const LIVE_TRACKING_STATUSES: ReadonlySet<string> = new Set([
  BookingStatus.ASSIGNED,
  BookingStatus.TECHNICIAN_EN_ROUTE,
  BookingStatus.IN_PROGRESS,
]);

export interface ActivityLike {
  toStatus: string | null;
  createdAt: Date;
  message: string | null;
}

/**
 * Builds the customer-facing timeline from booking activities: only status
 * transitions, oldest first, collapsing consecutive duplicates (e.g. two
 * RESCHEDULED → CONFIRMED hops).
 */
export function buildTimeline(
  activities: ActivityLike[],
  createdAt: Date,
): { status: AppBookingStatus; at: string; note: string | null }[] {
  const sorted = [...activities]
    .filter((a) => a.toStatus)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const out: { status: AppBookingStatus; at: string; note: string | null }[] = [];
  for (const a of sorted) {
    const status = toAppBookingStatus(a.toStatus!);
    if (out.length && out[out.length - 1]!.status === status) continue;
    out.push({ status, at: a.createdAt.toISOString(), note: a.message ?? null });
  }
  if (!out.length || out[0]!.status !== 'CREATED') {
    out.unshift({ status: 'CREATED', at: createdAt.toISOString(), note: null });
  }
  return out;
}

// ------------------------------------------------------------- categories

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  AC_REPAIR: 'Air Conditioner',
  AC_INSTALLATION: 'Air Conditioner',
  AC_SERVICING: 'Air Conditioner',
  REFRIGERATOR: 'Refrigerator',
  WASHING_MACHINE: 'Washing Machine',
  MICROWAVE: 'Microwave',
  GEYSER: 'Geyser',
  CHIMNEY: 'Chimney',
  TELEVISION: 'Television',
  WATER_PURIFIER: 'Water Purifier',
  DISHWASHER: 'Dishwasher',
  AIR_COOLER: 'Air Cooler',
  INVERTER_UPS: 'Inverter / UPS',
  CEILING_FAN: 'Ceiling Fan',
  OVEN: 'Oven',
  VACUUM_CLEANER: 'Vacuum Cleaner',
  ELECTRICAL_WIRING: 'Electrical Wiring',
  OTHER: 'Appliance',
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category as ServiceCategory] ?? 'Appliance';
}

/** Legacy / client-side aliases still sent by older app builds. */
const CATEGORY_ALIASES: Record<string, ServiceCategory> = {
  WASHING_MACHINE_REPAIR: ServiceCategory.WASHING_MACHINE,
  REFRIGERATOR_REPAIR: ServiceCategory.REFRIGERATOR,
  FRIDGE: ServiceCategory.REFRIGERATOR,
  MICROWAVE_REPAIR: ServiceCategory.MICROWAVE,
  TV_REPAIR: ServiceCategory.TELEVISION,
  TV: ServiceCategory.TELEVISION,
  GEYSER_REPAIR: ServiceCategory.GEYSER,
  RO: ServiceCategory.WATER_PURIFIER,
  RO_PURIFIER: ServiceCategory.WATER_PURIFIER,
  UPS: ServiceCategory.INVERTER_UPS,
  INVERTER: ServiceCategory.INVERTER_UPS,
  FAN: ServiceCategory.CEILING_FAN,
  AC: ServiceCategory.AC_REPAIR,
};

/** Normalise an app-supplied category (case-insensitive, aliases) → ServiceCategory or null. */
export function normalizeCategory(input: string | null | undefined): ServiceCategory | null {
  if (!input) return null;
  const key = input.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if ((Object.values(ServiceCategory) as string[]).includes(key)) return key as ServiceCategory;
  return CATEGORY_ALIASES[key] ?? null;
}

/** `no-cooling` → `No cooling` */
export function humanizeSlug(slug: string): string {
  const s = slug.replace(/[-_]+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
}

// --------------------------------------------------------------- invoices

export type AppInvoiceStatus = 'PENDING' | 'PAID' | 'PARTIAL' | 'REFUNDED' | 'CANCELLED';

export function toAppInvoiceStatus(status: string): AppInvoiceStatus {
  switch (status) {
    case InvoiceStatus.PAID:
      return 'PAID';
    case InvoiceStatus.PARTIALLY_PAID:
      return 'PARTIAL';
    case InvoiceStatus.REFUNDED:
      return 'REFUNDED';
    case InvoiceStatus.CANCELLED:
      return 'CANCELLED';
    case InvoiceStatus.DRAFT:
    case InvoiceStatus.SENT:
    case InvoiceStatus.OVERDUE:
    default:
      return 'PENDING';
  }
}

// -------------------------------------------------------------------- AMC

export type AppAmcStatus = 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'PENDING';

export const AMC_EXPIRING_WINDOW_DAYS = 30;

export function toAppAmcStatus(status: string, endsAt: Date, now = new Date()): AppAmcStatus {
  switch (status) {
    case AMCSubscriptionStatus.ACTIVE: {
      if (endsAt.getTime() < now.getTime()) return 'EXPIRED';
      const days = (endsAt.getTime() - now.getTime()) / 86_400_000;
      return days <= AMC_EXPIRING_WINDOW_DAYS ? 'EXPIRING' : 'ACTIVE';
    }
    case AMCSubscriptionStatus.PENDING_PAYMENT:
    case AMCSubscriptionStatus.PAUSED:
      return 'PENDING';
    case AMCSubscriptionStatus.EXPIRED:
    case AMCSubscriptionStatus.CANCELLED:
    default:
      return 'EXPIRED';
  }
}

/** AMCPlan.features is free-form JSON; coerce to string bullets. */
export function planFeatures(features: unknown): string[] {
  if (!Array.isArray(features)) return [];
  return features
    .map((f) => (typeof f === 'string' ? f : f && typeof f === 'object' && 'label' in f ? String((f as { label: unknown }).label) : null))
    .filter((f): f is string => !!f && f.length > 0);
}

/** Subscription appliancesSnapshot JSON → app appliance rows. */
export function snapshotAppliances(snapshot: unknown): { applianceCategory: string; label: string }[] {
  if (!Array.isArray(snapshot)) return [];
  const out: { applianceCategory: string; label: string }[] = [];
  for (const item of snapshot) {
    if (typeof item === 'string') {
      out.push({ applianceCategory: item, label: categoryLabel(item) });
    } else if (item && typeof item === 'object') {
      const rec = item as Record<string, unknown>;
      const cat = typeof rec.category === 'string' ? rec.category : 'OTHER';
      const label =
        typeof rec.label === 'string'
          ? rec.label
          : [rec.brand, categoryLabel(cat)].filter((x) => typeof x === 'string' && x).join(' ');
      out.push({ applianceCategory: cat, label });
    }
  }
  return out;
}

// ----------------------------------------------------------- notifications

export type AppNotificationType = 'BOOKING' | 'PAYMENT' | 'AMC' | 'PROMO' | 'SUPPORT' | 'SYSTEM';

export function notificationTypeForTemplate(template: string): AppNotificationType {
  const t = template.toLowerCase();
  if (t.startsWith('booking') || t.startsWith('dispatch') || t.startsWith('technician')) return 'BOOKING';
  if (t.startsWith('payment') || t.startsWith('invoice') || t.startsWith('refund')) return 'PAYMENT';
  if (t.startsWith('amc')) return 'AMC';
  if (t.startsWith('promo') || t.startsWith('campaign') || t.startsWith('marketing') || t.startsWith('referral') || t.startsWith('coupon'))
    return 'PROMO';
  if (t.startsWith('ticket') || t.startsWith('support')) return 'SUPPORT';
  return 'SYSTEM';
}

/** Keys never forwarded to the client inside `data`, even if a template payload carries them. */
const SENSITIVE_PAYLOAD_KEYS = new Set(['code', 'otp', 'token', 'password', 'secret', 'cardnumber', 'card']);

/** Flattens a notification payload to the `Record<string,string>` the app expects. */
export function notificationData(payload: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return out;
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    if (SENSITIVE_PAYLOAD_KEYS.has(k.toLowerCase())) continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = String(v);
  }
  return out;
}

/** `booking.assigned` → `Booking assigned` */
export function titleFromTemplate(template: string): string {
  return humanizeSlug(template.replace(/\./g, ' '));
}

// --------------------------------------------------------------- addresses

export type AppAddressLabel = 'HOME' | 'WORK' | 'OTHER';

export function toAppAddressLabel(label: string | null | undefined): AppAddressLabel {
  const l = (label ?? '').trim().toUpperCase();
  if (l === 'HOME' || l === 'WORK') return l;
  return 'OTHER';
}

// ---------------------------------------------------------------- payments

export type AppPaymentMethodType = 'CARD' | 'UPI' | 'WALLET' | 'NETBANKING';

export function toAppPaymentMethodType(type: string): AppPaymentMethodType {
  const t = type.toUpperCase().replace(/[\s_-]/g, '');
  if (t === 'UPI') return 'UPI';
  if (t === 'WALLET') return 'WALLET';
  if (t === 'NETBANKING') return 'NETBANKING';
  return 'CARD';
}

// --------------------------------------------------------------- appliances

export type WarrantyStatus = 'IN_WARRANTY' | 'EXPIRING_SOON' | 'EXPIRED' | 'UNKNOWN';

export const WARRANTY_EXPIRING_WINDOW_DAYS = 30;

/** Warranty state using the later of manufacturer / extended cover. */
export function warrantyStatus(
  until: (Date | null | undefined)[],
  now = new Date(),
): { status: WarrantyStatus; until: Date | null; daysLeft: number | null } {
  const dates = until.filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()));
  if (!dates.length) return { status: 'UNKNOWN', until: null, daysLeft: null };
  const latest = new Date(Math.max(...dates.map((d) => d.getTime())));
  const daysLeft = Math.ceil((latest.getTime() - now.getTime()) / 86_400_000);
  if (daysLeft < 0) return { status: 'EXPIRED', until: latest, daysLeft };
  if (daysLeft <= WARRANTY_EXPIRING_WINDOW_DAYS) return { status: 'EXPIRING_SOON', until: latest, daysLeft };
  return { status: 'IN_WARRANTY', until: latest, daysLeft };
}
