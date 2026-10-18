/**
 * Shared types for the customer-app API surface.
 *
 * These mirror the API contracts but stay intentionally narrow — we only
 * expose fields the customer app actually consumes. Keeping the shapes
 * here (instead of importing from `@ac/types`) keeps the mobile bundle
 * lean and decoupled from server-only enums.
 */
export type BookingStatus =
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

export interface BookingAddress {
  line1: string;
  line2?: string | null;
  city: string;
  pincode: string;
  landmark?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface BookingTechnician {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  rating?: number | null;
  completedJobs?: number | null;
  phone?: string | null;
  whatsapp?: string | null;
}

export interface BookingSummary {
  id: string;
  code: string;
  status: BookingStatus;
  applianceCategory: string;
  applianceLabel: string;
  issueLabel: string;
  scheduledAt: string;
  slotLabel?: string | null;
  estimateMinor?: number | null;
  amountMinor?: number | null;
  address?: BookingAddress;
  technician?: BookingTechnician | null;
  isEmergency?: boolean;
  /** Registered appliance this job is for (see {@link CustomerAppliance}). */
  applianceId?: string | null;
  serviceMode?: ServiceMode;
  couponCode?: string | null;
  discountMinor?: number;
  createdAt: string;
}

export type ServiceMode = 'ON_SITE' | 'PICKUP_DROP' | 'CARRY_IN';

export interface BookingDetail extends BookingSummary {
  notes?: string | null;
  photoUrls: string[];
  timeline: { status: BookingStatus; at: string; note?: string | null }[];
  invoiceId?: string | null;
  rating?: { value: number; comment?: string | null; npsScore?: number | null } | null;
}

export interface InvoiceSummary {
  id: string;
  number: string;
  status: 'PENDING' | 'PAID' | 'PARTIAL' | 'REFUNDED' | 'CANCELLED';
  amountMinor: number;
  /** Outstanding balance (amountMinor − paid). */
  dueMinor?: number;
  paidMinor?: number;
  currency?: string;
  dueAt?: string | null;
  issuedAt: string;
  bookingId?: string | null;
  amcSubscriptionId?: string | null;
  /** Signed, short-lived PDF link (opens in the browser without a token). */
  pdfUrl?: string | null;
}

export interface InvoiceDetail extends InvoiceSummary {
  lineItems: { label: string; amountMinor: number }[];
  pdfUrl: string;
  subtotalMinor?: number;
  taxMinor?: number;
  discountMinor?: number;
}

export interface PaymentIntent {
  gateway: 'razorpay' | 'stripe';
  orderId: string;
  transactionId?: string;
  key: string;
  amountMinor: number;
  currency: string;
  clientSecret?: string;
  /** Hosted checkout URL opened in the in-app browser. */
  checkoutUrl: string | null;
}

export interface PaymentMethod {
  id: string;
  type: 'CARD' | 'UPI' | 'WALLET' | 'NETBANKING';
  label: string;
  last4?: string | null;
  brand?: string | null;
  isDefault?: boolean;
  expiresAt?: string | null;
  gateway?: string;
}

export interface AmcPlan {
  id: string;
  name: string;
  tagline: string;
  priceMinor: number;
  durationMonths: number;
  visitsIncluded: number;
  features: string[];
  emergencyIncluded: boolean;
  popular?: boolean;
  renewalPriceMinor?: number;
  /** ServiceCategory values; empty = all appliances. */
  appliancesCovered?: string[];
}

export interface AmcSubscription {
  id: string;
  planId: string;
  planName: string;
  status: 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'PENDING';
  startsAt: string;
  expiresAt: string;
  visitsRemaining: number;
  visitsTotal: number;
  appliances: { applianceCategory: string; label: string }[];
  emergencyIncluded: boolean;
  number?: string;
  autoRenew?: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: 'BOOKING' | 'PAYMENT' | 'AMC' | 'PROMO' | 'SUPPORT' | 'SYSTEM';
  readAt?: string | null;
  createdAt: string;
  data?: Record<string, string>;
}

export interface SupportTicketSummary {
  id: string;
  number?: string;
  subject: string;
  status:
    | 'OPEN'
    | 'PENDING'
    | 'WAITING_CUSTOMER'
    | 'AWAITING_CUSTOMER'
    | 'ON_HOLD'
    | 'ESCALATED'
    | 'IN_PROGRESS'
    | 'RESOLVED'
    | 'CLOSED';
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  source?: string;
  bookingId?: string | null;
  lastMessageAt: string;
  unreadCount: number;
  satisfactionRating?: number | null;
}

export interface SupportMessage {
  id: string;
  body: string;
  authorKind: 'CUSTOMER' | 'AGENT' | 'SYSTEM' | 'BOT';
  channel: string | null;
  createdAt: string;
  author?: { firstName: string | null; lastName: string | null } | null;
}

export interface FaqItem {
  q: string;
  a: string;
  slug?: string;
}

export interface CustomerAddress {
  id: string;
  label: 'HOME' | 'WORK' | 'OTHER';
  line1: string;
  line2?: string | null;
  city: string;
  pincode: string;
  landmark?: string | null;
  isDefault: boolean;
  lat?: number | null;
  lng?: number | null;
  state?: string | null;
}

export interface TechnicianLocation {
  bookingId: string;
  technicianId: string;
  lat: number;
  lng: number;
  bearing?: number | null;
  speedKph?: number | null;
  etaMinutes?: number | null;
  distanceKm?: number | null;
  recordedAt: string;
}

export type WarrantyStatus = 'IN_WARRANTY' | 'EXPIRING_SOON' | 'EXPIRED' | 'UNKNOWN';

/** A physical appliance the customer registered (`/v1/me/appliances`). */
export interface CustomerAppliance {
  id: string;
  category: string;
  categoryLabel: string;
  brand: string;
  modelNumber?: string | null;
  serialNumber?: string | null;
  capacity?: string | null;
  installedLocation?: string | null;
  purchaseDate?: string | null;
  installDate?: string | null;
  manufacturerWarrantyUntil?: string | null;
  extendedWarrantyUntil?: string | null;
  warranty: { status: WarrantyStatus; until: string | null; daysLeft: number | null };
  photos: string[];
  addressId?: string | null;
  notes?: string | null;
  lastServicedAt?: string | null;
  createdAt: string;
}

export interface CustomerApplianceInput {
  category: string;
  brand: string;
  modelNumber?: string | null;
  serialNumber?: string | null;
  capacity?: string | null;
  installedLocation?: string | null;
  purchaseDate?: string | null;
  installDate?: string | null;
  manufacturerWarrantyUntil?: string | null;
  photos?: string[];
  addressId?: string | null;
  notes?: string | null;
}

export type ReferralStatus = 'PENDING' | 'QUALIFIED' | 'REWARDED' | 'REJECTED';

export interface ReferralSummary {
  code: string;
  shareUrl: string;
  referredCount: number;
  rewardedCount: number;
  totalRewardMinor: number;
  referrals: {
    id: string;
    status: ReferralStatus;
    rewardMinor: number;
    createdAt: string;
    referredName: string;
  }[];
}

export interface CouponValidation {
  valid: boolean;
  discountMinor: number;
  message?: string;
}

export interface BookingSlot {
  start: string;
  end: string;
  available: boolean;
}

export interface CreateBookingInput {
  applianceCategory: string;
  issueId?: string;
  issueLabel?: string;
  notes?: string;
  photoUrls?: string[];
  scheduledAt: string;
  slotEnd?: string;
  slotLabel?: string;
  isEmergency?: boolean;
  addressId: string;
  contactPhone?: string;
  applianceId?: string;
  serviceMode?: ServiceMode;
  couponCode?: string;
}

export interface UserDevice {
  id: string;
  deviceId: string;
  modelName: string | null;
  platform?: string | null;
  lastSeenAt: string;
  current: boolean;
}
