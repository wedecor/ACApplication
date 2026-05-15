/**
 * Shared types for the customer-app API surface.
 *
 * These mirror the API contracts but stay intentionally narrow \u2014 we only
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
  createdAt: string;
}

export interface BookingDetail extends BookingSummary {
  notes?: string | null;
  photoUrls: string[];
  timeline: { status: BookingStatus; at: string; note?: string | null }[];
  invoiceId?: string | null;
  rating?: { value: number; comment?: string | null } | null;
}

export interface InvoiceSummary {
  id: string;
  number: string;
  status: 'PENDING' | 'PAID' | 'PARTIAL' | 'REFUNDED' | 'CANCELLED';
  amountMinor: number;
  dueAt?: string | null;
  issuedAt: string;
  bookingId?: string | null;
  pdfUrl?: string | null;
}

export interface PaymentMethod {
  id: string;
  type: 'CARD' | 'UPI' | 'WALLET' | 'NETBANKING';
  label: string;
  last4?: string | null;
  brand?: string | null;
  isDefault?: boolean;
  expiresAt?: string | null;
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
