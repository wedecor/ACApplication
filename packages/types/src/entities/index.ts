import type {
  Address,
  AuditFields,
  BookingId,
  CityId,
  CustomerId,
  GeoPoint,
  InvoiceId,
  Money,
  PhoneNumberE164,
  TechnicianId,
  TenantId,
  UserId,
} from '../common';
import type {
  ActivityType,
  AMCPlanType,
  AMCSubscriptionStatus,
  AMCVisitStatus,
  BookingAttachmentKind,
  BookingPaymentStatus,
  BookingStatus,
  CommissionStatus,
  CommissionType,
  CreditNoteStatus,
  DispatchAlertKind,
  DispatchDecision,
  InvoiceStatus,
  LeadPriority,
  LeadSource,
  LeadStatus,
  LedgerEntryDirection,
  LedgerEntryType,
  NotificationChannel,
  NotificationStatus,
  PaymentMethod,
  PaymentTransactionStatus,
  PayoutCycle,
  PayoutStatus,
  Permission,
  QuotationStatus,
  RefundStatus,
  ServiceCategory,
  TechnicianStatus,
  UserRole,
  UserStatus,
} from '../enums';

export type LeadId = string & { readonly __brand: 'LeadId' };
export type DispatchAssignmentId = string & { readonly __brand: 'DispatchAssignmentId' };
export type DispatchEventId = string & { readonly __brand: 'DispatchEventId' };
export type QuotationId = string & { readonly __brand: 'QuotationId' };
export type AMCPlanId = string & { readonly __brand: 'AMCPlanId' };
export type AMCSubscriptionId = string & { readonly __brand: 'AMCSubscriptionId' };
export type AMCVisitId = string & { readonly __brand: 'AMCVisitId' };
export type CreditNoteId = string & { readonly __brand: 'CreditNoteId' };
export type RefundId = string & { readonly __brand: 'RefundId' };
export type PaymentTransactionId = string & { readonly __brand: 'PaymentTransactionId' };
export type TechnicianPayoutId = string & { readonly __brand: 'TechnicianPayoutId' };
export type TechnicianCommissionId = string & { readonly __brand: 'TechnicianCommissionId' };

/**
 * NOTE: These are wire-format / DTO representations. The Prisma client owns
 * the runtime DB shape. Keeping these as plain TS interfaces lets us share
 * contracts across web, mobile and 3rd-party API consumers without coupling
 * them to the ORM.
 */

export interface User extends AuditFields {
  id: UserId;
  tenantId: TenantId;
  email: string | null;
  phone: PhoneNumberE164 | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  roles: UserRole[];
  permissions: Permission[];
  lastLoginAt: string | null;
}

export interface Customer extends AuditFields {
  id: CustomerId;
  userId: UserId;
  cityId: CityId | null;
  fullName: string;
  email: string | null;
  phone: PhoneNumberE164;
  addresses: Address[];
  defaultAddressId: string | null;
  lifetimeValueMinor: number;
  totalBookings: number;
}

export interface Technician extends AuditFields {
  id: TechnicianId;
  userId: UserId;
  cityId: CityId;
  employeeCode: string;
  fullName: string;
  phone: PhoneNumberE164;
  skills: ServiceCategory[];
  rating: number;
  totalJobs: number;
  status: TechnicianStatus;
  lastLocation: GeoPoint | null;
  lastLocationAt: string | null;
}

export interface Booking extends AuditFields {
  id: BookingId;
  code: string;
  leadId: LeadId | null;
  customerId: CustomerId;
  technicianId: TechnicianId | null;
  cityId: CityId;
  category: ServiceCategory;
  serviceType: string | null;
  applianceBrand: string | null;
  applianceType: string | null;
  issueDescription: string | null;
  status: BookingStatus;
  paymentStatus: BookingPaymentStatus;
  scheduledAt: string;
  scheduledTimeSlot: string | null;
  assignedAt: string | null;
  enRouteAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  waitingPartsAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  rescheduleCount: number;
  address: Address;
  geoLocation: GeoPoint | null;
  notes: string | null;
  customerSignatureUrl: string | null;
  otpVerifiedAt: string | null;
  estimatedAmount: Money;
  finalAmount: Money | null;
}

export interface BookingActivityEntry {
  id: string;
  bookingId: BookingId;
  type: ActivityType;
  fromStatus: string | null;
  toStatus: string | null;
  actorUserId: UserId | null;
  message: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface BookingNoteEntry {
  id: string;
  bookingId: BookingId;
  authorUserId: UserId;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

export interface BookingAttachmentEntry {
  id: string;
  bookingId: BookingId;
  kind: BookingAttachmentKind;
  url: string;
  mimeType: string | null;
  sizeBytes: number | null;
  caption: string | null;
  uploadedBy: UserId | null;
  createdAt: string;
}

// ============================================================================
// LEAD
// ============================================================================

export interface Lead extends AuditFields {
  id: LeadId;
  code: string;
  tenantId: TenantId;
  customerName: string;
  phone: PhoneNumberE164;
  whatsappNumber: PhoneNumberE164 | null;
  email: string | null;
  source: LeadSource;
  applianceType: ServiceCategory | null;
  applianceBrand: string | null;
  issueDescription: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  landmark: string | null;
  cityId: CityId | null;
  cityLabel: string | null;
  pincode: string | null;
  geoLocation: GeoPoint | null;
  priority: LeadPriority;
  status: LeadStatus;
  tags: string[];
  assignedUserId: UserId | null;
  assignedAt: string | null;
  qualifiedAt: string | null;
  contactedAt: string | null;
  closedAt: string | null;
  bookingId: BookingId | null;
  convertedAt: string | null;
  externalRef: string | null;
  metadata: Record<string, unknown>;
}

export interface LeadNoteEntry {
  id: string;
  leadId: LeadId;
  authorUserId: UserId;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadActivityEntry {
  id: string;
  leadId: LeadId;
  type: ActivityType;
  fromStatus: string | null;
  toStatus: string | null;
  actorUserId: UserId | null;
  message: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: Money;
  taxRate: number;
  totalMinor: number;
}

export interface Notification extends AuditFields {
  id: string;
  userId: UserId;
  channel: NotificationChannel;
  status: NotificationStatus;
  template: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  sentAt: string | null;
}

export interface City extends AuditFields {
  id: CityId;
  name: string;
  state: string;
  country: string;
  pincodes: string[];
  isActive: boolean;
  serviceableFrom: string | null;
}

// ============================================================================
// DISPATCH + LIVE TRACKING
// ============================================================================

export interface TechnicianLocationPing {
  id?: string;
  technicianId: TechnicianId;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  heading: number | null;
  speedMps: number | null;
  altitudeM: number | null;
  batteryPct: number | null;
  isBackground: boolean;
  wasOffline: boolean;
  signature?: string | null;
  deviceId?: string | null;
  source?: string | null;
  /** ISO timestamp from the device at capture. */
  recordedAt: string;
  /** ISO timestamp from the server at ingest. Populated by the API. */
  receivedAt?: string;
}

/** What a live-map cell renders for one technician — denormalised. */
export interface LiveTechnicianSnapshot {
  technicianId: TechnicianId;
  fullName: string;
  cityId: CityId;
  status: TechnicianStatus;
  rating: number;
  activeJobs: number;
  latitude: number | null;
  longitude: number | null;
  heading: number | null;
  speedMps: number | null;
  batteryPct: number | null;
  lastSeenAt: string | null;
  lastLocationAt: string | null;
  /** Most recent assigned booking, if any. */
  activeBookingId: BookingId | null;
  activeBookingCode: string | null;
}

export interface DispatchAssignmentRecord {
  id: DispatchAssignmentId;
  bookingId: BookingId;
  technicianId: TechnicianId;
  decision: DispatchDecision;
  score: number | null;
  breakdown: Record<string, number>;
  distanceKm: number | null;
  etaMin: number | null;
  reason: string | null;
  replacesId: DispatchAssignmentId | null;
  actorUserId: UserId | null;
  createdAt: string;
}

export interface DispatchAlertRecord {
  id: DispatchEventId;
  kind: DispatchAlertKind;
  severity: 'info' | 'warning' | 'critical';
  resourceType: string | null;
  resourceId: string | null;
  technicianId: TechnicianId | null;
  message: string;
  metadata: Record<string, unknown>;
  acknowledgedAt: string | null;
  acknowledgedBy: UserId | null;
  createdAt: string;
}

export interface RouteEstimate {
  distanceM: number;
  durationS: number;
  trafficDurationS: number | null;
  /** Encoded polyline (Google/Mapbox compatible). Empty for Haversine. */
  polyline: string | null;
  provider: 'haversine' | 'google' | 'mapbox';
}

// ============================================================================
// FINANCE
// ============================================================================

export interface InvoiceLineItemInput {
  description: string;
  quantity: number;
  unitPriceMinor: number;
  discountMinor?: number;
  taxRateBps?: number;
  hsnSacCode?: string | null;
}

export interface InvoiceLineItem extends InvoiceLineItemInput {
  id: string;
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

export interface Invoice extends AuditFields {
  id: InvoiceId;
  number: string;
  customerId: CustomerId;
  bookingId: BookingId | null;
  amcSubscriptionId: AMCSubscriptionId | null;
  status: InvoiceStatus;
  issueDate: string | null;
  dueDate: string | null;
  paidAt: string | null;
  sentAt: string | null;
  cancelledAt: string | null;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  amountPaidMinor: number;
  amountRefundedMinor: number;
  dueAmountMinor: number;
  currency: string;
  gstEnabled: boolean;
  gstNumber: string | null;
  placeOfSupply: string | null;
  notes: string | null;
  terms: string | null;
  pdfUrl: string | null;
  pdfHash: string | null;
  generatedBy: string | null;
  lineItems: InvoiceLineItem[];
}

export interface Quotation extends AuditFields {
  id: QuotationId;
  number: string;
  customerId: CustomerId;
  bookingId: BookingId | null;
  status: QuotationStatus;
  expiresAt: string;
  sentAt: string | null;
  viewedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  convertedAt: string | null;
  convertedInvoiceId: InvoiceId | null;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  currency: string;
  gstEnabled: boolean;
  notes: string | null;
  terms: string | null;
  pdfUrl: string | null;
  viewToken: string;
  rejectedReason: string | null;
  lineItems: InvoiceLineItem[];
}

export interface PaymentTransactionEntity {
  id: PaymentTransactionId;
  customerId: CustomerId;
  invoiceId: InvoiceId | null;
  amcSubscriptionId: AMCSubscriptionId | null;
  provider: 'razorpay' | 'stripe' | 'manual';
  purpose: string;
  method: PaymentMethod | null;
  status: PaymentTransactionStatus;
  amountMinor: number;
  currency: string;
  orderRef: string | null;
  paymentRef: string | null;
  hostedLink: string | null;
  failureCode: string | null;
  failureReason: string | null;
  createdAt: string;
  capturedAt: string | null;
}

export interface RefundEntity {
  id: RefundId;
  paymentId: string;
  invoiceId: InvoiceId | null;
  customerId: CustomerId;
  amountMinor: number;
  currency: string;
  reason: string | null;
  status: RefundStatus;
  gatewayRef: string | null;
  approvedBy: UserId | null;
  processedAt: string | null;
  createdAt: string;
}

export interface CreditNoteEntity {
  id: CreditNoteId;
  number: string;
  customerId: CustomerId;
  invoiceId: InvoiceId | null;
  status: CreditNoteStatus;
  amountMinor: number;
  currency: string;
  reason: string | null;
  issuedAt: string | null;
  appliedAt: string | null;
  pdfUrl: string | null;
}

export interface CustomerLedgerEntry {
  id: string;
  customerId: CustomerId;
  entryType: LedgerEntryType;
  direction: LedgerEntryDirection;
  amountMinor: number;
  currency: string;
  description: string;
  invoiceId: InvoiceId | null;
  paymentId: string | null;
  refundId: RefundId | null;
  creditNoteId: CreditNoteId | null;
  amcSubscriptionId: AMCSubscriptionId | null;
  runningBalanceMinor: number;
  occurredAt: string;
}

export interface AMCPlan {
  id: AMCPlanId;
  slug: string;
  name: string;
  type: AMCPlanType;
  description: string | null;
  durationMonths: number;
  includedVisits: number;
  emergencySupport: boolean;
  prioritySupport: boolean;
  discountBps: number;
  appliancesCovered: ServiceCategory[];
  priceMinor: number;
  renewalPriceMinor: number;
  currency: string;
  visitCadenceDays: number;
  isActive: boolean;
  features: string[];
}

export interface AMCSubscription extends AuditFields {
  id: AMCSubscriptionId;
  number: string;
  customerId: CustomerId;
  planId: AMCPlanId;
  status: AMCSubscriptionStatus;
  startsAt: string;
  endsAt: string;
  cancelledAt: string | null;
  pausedAt: string | null;
  resumedAt: string | null;
  priceMinor: number;
  renewalPriceMinor: number;
  autoRenew: boolean;
  visitsScheduled: number;
  visitsCompleted: number;
  appliancesSnapshot: ServiceCategory[];
}

export interface AMCVisitEntry {
  id: AMCVisitId;
  subscriptionId: AMCSubscriptionId;
  visitNumber: number;
  status: AMCVisitStatus;
  scheduledFor: string;
  completedAt: string | null;
  bookingId: BookingId | null;
  isComplimentary: boolean;
  notes: string | null;
}

export interface TechnicianCommissionRecord {
  id: TechnicianCommissionId;
  technicianId: TechnicianId;
  bookingId: BookingId;
  baseMinor: number;
  bonusMinor: number;
  penaltyMinor: number;
  adjustmentMinor: number;
  netMinor: number;
  currency: string;
  status: CommissionStatus;
  payoutId: TechnicianPayoutId | null;
  ruleSnapshot: { type: CommissionType; valueMinor: number };
  notes: string | null;
  createdAt: string;
}

export interface TechnicianPayoutRecord {
  id: TechnicianPayoutId;
  technicianId: TechnicianId;
  code: string;
  periodStart: string;
  periodEnd: string;
  jobsCount: number;
  grossMinor: number;
  bonusMinor: number;
  penaltyMinor: number;
  adjustmentMinor: number;
  netMinor: number;
  currency: string;
  status: PayoutStatus;
  cycle?: PayoutCycle;
  approvedBy: UserId | null;
  approvedAt: string | null;
  paidAt: string | null;
  notes: string | null;
}
