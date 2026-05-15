/**
 * String-literal enums shared across API ↔ Web ↔ Mobile.
 * Prisma generates structurally-equivalent enums; we re-export string unions
 * here so that consumers of `@ac/types` don't need to import `@prisma/client`.
 */

export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  DISPATCHER: 'DISPATCHER',
  TECHNICIAN: 'TECHNICIAN',
  CALL_CENTER_AGENT: 'CALL_CENTER_AGENT',
  CUSTOMER: 'CUSTOMER',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  DELETED: 'DELETED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const BookingStatus = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  ASSIGNED: 'ASSIGNED',
  TECHNICIAN_EN_ROUTE: 'TECHNICIAN_EN_ROUTE',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_PARTS: 'WAITING_PARTS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  RESCHEDULED: 'RESCHEDULED',
  NO_SHOW: 'NO_SHOW',
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

/** Terminal booking states — no further transitions allowed. */
export const TERMINAL_BOOKING_STATUSES = new Set<BookingStatus>([
  BookingStatus.COMPLETED,
  BookingStatus.CANCELLED,
  BookingStatus.NO_SHOW,
]);

/**
 * Valid forward transitions for the booking state machine. Backward / lateral
 * jumps are blocked by the service layer. Bookings can be cancelled from any
 * non-terminal state via a separate guard, so CANCELLED is not enumerated here.
 */
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.DRAFT]: [BookingStatus.PENDING, BookingStatus.CANCELLED],
  [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.ASSIGNED, BookingStatus.CANCELLED],
  [BookingStatus.CONFIRMED]: [BookingStatus.ASSIGNED, BookingStatus.CANCELLED, BookingStatus.RESCHEDULED],
  [BookingStatus.ASSIGNED]: [
    BookingStatus.TECHNICIAN_EN_ROUTE,
    BookingStatus.RESCHEDULED,
    BookingStatus.CANCELLED,
    BookingStatus.NO_SHOW,
  ],
  [BookingStatus.TECHNICIAN_EN_ROUTE]: [
    BookingStatus.IN_PROGRESS,
    BookingStatus.NO_SHOW,
    BookingStatus.CANCELLED,
  ],
  [BookingStatus.IN_PROGRESS]: [
    BookingStatus.WAITING_PARTS,
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED,
  ],
  [BookingStatus.WAITING_PARTS]: [BookingStatus.IN_PROGRESS, BookingStatus.CANCELLED],
  [BookingStatus.RESCHEDULED]: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
  [BookingStatus.COMPLETED]: [],
  [BookingStatus.CANCELLED]: [],
  [BookingStatus.NO_SHOW]: [],
};

export function canTransitionBooking(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from].includes(to);
}

export const BookingPaymentStatus = {
  UNPAID: 'UNPAID',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
  REFUNDED: 'REFUNDED',
} as const;
export type BookingPaymentStatus = (typeof BookingPaymentStatus)[keyof typeof BookingPaymentStatus];

export const BookingAttachmentKind = {
  PRE_SERVICE_PHOTO: 'PRE_SERVICE_PHOTO',
  POST_SERVICE_PHOTO: 'POST_SERVICE_PHOTO',
  INVOICE: 'INVOICE',
  DOCUMENT: 'DOCUMENT',
  PARTS_PHOTO: 'PARTS_PHOTO',
  OTHER: 'OTHER',
} as const;
export type BookingAttachmentKind =
  (typeof BookingAttachmentKind)[keyof typeof BookingAttachmentKind];

export const ServiceCategory = {
  AC_REPAIR: 'AC_REPAIR',
  AC_INSTALLATION: 'AC_INSTALLATION',
  AC_SERVICING: 'AC_SERVICING',
  REFRIGERATOR: 'REFRIGERATOR',
  WASHING_MACHINE: 'WASHING_MACHINE',
  MICROWAVE: 'MICROWAVE',
  GEYSER: 'GEYSER',
  CHIMNEY: 'CHIMNEY',
  OTHER: 'OTHER',
} as const;
export type ServiceCategory = (typeof ServiceCategory)[keyof typeof ServiceCategory];

export const PaymentStatus = {
  PENDING: 'PENDING',
  AUTHORIZED: 'AUTHORIZED',
  CAPTURED: 'CAPTURED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PaymentMethod = {
  CASH: 'CASH',
  UPI: 'UPI',
  CARD: 'CARD',
  NET_BANKING: 'NET_BANKING',
  WALLET: 'WALLET',
  RAZORPAY: 'RAZORPAY',
  STRIPE: 'STRIPE',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const InvoiceStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const TERMINAL_INVOICE_STATUSES = new Set<InvoiceStatus>([
  InvoiceStatus.CANCELLED,
  InvoiceStatus.REFUNDED,
]);

export const QuotationStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  VIEWED: 'VIEWED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  CONVERTED: 'CONVERTED',
} as const;
export type QuotationStatus = (typeof QuotationStatus)[keyof typeof QuotationStatus];

export const TERMINAL_QUOTATION_STATUSES = new Set<QuotationStatus>([
  QuotationStatus.REJECTED,
  QuotationStatus.EXPIRED,
  QuotationStatus.CONVERTED,
]);

export const PaymentTransactionStatus = {
  CREATED: 'CREATED',
  PENDING: 'PENDING',
  AUTHORIZED: 'AUTHORIZED',
  CAPTURED: 'CAPTURED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
} as const;
export type PaymentTransactionStatus =
  (typeof PaymentTransactionStatus)[keyof typeof PaymentTransactionStatus];

export const RefundStatus = {
  REQUESTED: 'REQUESTED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;
export type RefundStatus = (typeof RefundStatus)[keyof typeof RefundStatus];

export const CreditNoteStatus = {
  DRAFT: 'DRAFT',
  ISSUED: 'ISSUED',
  APPLIED: 'APPLIED',
  VOID: 'VOID',
} as const;
export type CreditNoteStatus = (typeof CreditNoteStatus)[keyof typeof CreditNoteStatus];

export const LedgerEntryType = {
  INVOICE: 'INVOICE',
  PAYMENT: 'PAYMENT',
  REFUND: 'REFUND',
  CREDIT_NOTE: 'CREDIT_NOTE',
  AMC_CHARGE: 'AMC_CHARGE',
  AMC_CREDIT: 'AMC_CREDIT',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;
export type LedgerEntryType = (typeof LedgerEntryType)[keyof typeof LedgerEntryType];

export const LedgerEntryDirection = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
} as const;
export type LedgerEntryDirection =
  (typeof LedgerEntryDirection)[keyof typeof LedgerEntryDirection];

export const AMCPlanType = {
  BASIC: 'BASIC',
  STANDARD: 'STANDARD',
  PREMIUM: 'PREMIUM',
  CUSTOM: 'CUSTOM',
} as const;
export type AMCPlanType = (typeof AMCPlanType)[keyof typeof AMCPlanType];

export const AMCSubscriptionStatus = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
} as const;
export type AMCSubscriptionStatus =
  (typeof AMCSubscriptionStatus)[keyof typeof AMCSubscriptionStatus];

export const AMCVisitStatus = {
  SCHEDULED: 'SCHEDULED',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  MISSED: 'MISSED',
  CANCELLED: 'CANCELLED',
  RESCHEDULED: 'RESCHEDULED',
} as const;
export type AMCVisitStatus = (typeof AMCVisitStatus)[keyof typeof AMCVisitStatus];

export const CommissionType = {
  FLAT: 'FLAT',
  PERCENTAGE: 'PERCENTAGE',
  PER_JOB: 'PER_JOB',
} as const;
export type CommissionType = (typeof CommissionType)[keyof typeof CommissionType];

export const CommissionStatus = {
  ACCRUED: 'ACCRUED',
  ADJUSTED: 'ADJUSTED',
  PAID: 'PAID',
  REVERSED: 'REVERSED',
} as const;
export type CommissionStatus = (typeof CommissionStatus)[keyof typeof CommissionStatus];

export const PayoutStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  PROCESSING: 'PROCESSING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
export type PayoutStatus = (typeof PayoutStatus)[keyof typeof PayoutStatus];

export const PayoutCycle = {
  WEEKLY: 'WEEKLY',
  BIWEEKLY: 'BIWEEKLY',
  MONTHLY: 'MONTHLY',
  ON_DEMAND: 'ON_DEMAND',
} as const;
export type PayoutCycle = (typeof PayoutCycle)[keyof typeof PayoutCycle];

export const NotificationChannel = {
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  PUSH: 'PUSH',
  WHATSAPP: 'WHATSAPP',
  IN_APP: 'IN_APP',
} as const;
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const NotificationStatus = {
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  RETRYING: 'RETRYING',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  FAILED: 'FAILED',
  DLQ: 'DLQ',
} as const;
export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];

export const TechnicianStatus = {
  OFFLINE: 'OFFLINE',
  ONLINE: 'ONLINE',
  AVAILABLE: 'AVAILABLE',
  BUSY: 'BUSY',
  ON_BREAK: 'ON_BREAK',
  EN_ROUTE: 'EN_ROUTE',
  WORKING: 'WORKING',
  UNREACHABLE: 'UNREACHABLE',
} as const;
export type TechnicianStatus = (typeof TechnicianStatus)[keyof typeof TechnicianStatus];

/** Statuses considered "actively able to take work right now". */
export const DISPATCHABLE_TECHNICIAN_STATUSES = new Set<TechnicianStatus>([
  TechnicianStatus.AVAILABLE,
  TechnicianStatus.ONLINE,
]);

/** Statuses where the technician is mid-job and not eligible for new work. */
export const ENGAGED_TECHNICIAN_STATUSES = new Set<TechnicianStatus>([
  TechnicianStatus.BUSY,
  TechnicianStatus.EN_ROUTE,
  TechnicianStatus.WORKING,
]);

/**
 * Transition matrix for the technician state machine. Used both server-side
 * (status endpoint) and client-side (mobile toggle UX).
 */
export const TECHNICIAN_STATUS_TRANSITIONS: Record<TechnicianStatus, TechnicianStatus[]> = {
  OFFLINE: [TechnicianStatus.ONLINE],
  ONLINE: [
    TechnicianStatus.AVAILABLE,
    TechnicianStatus.ON_BREAK,
    TechnicianStatus.OFFLINE,
    TechnicianStatus.UNREACHABLE,
  ],
  AVAILABLE: [
    TechnicianStatus.BUSY,
    TechnicianStatus.EN_ROUTE,
    TechnicianStatus.ON_BREAK,
    TechnicianStatus.OFFLINE,
    TechnicianStatus.UNREACHABLE,
  ],
  BUSY: [
    TechnicianStatus.EN_ROUTE,
    TechnicianStatus.WORKING,
    TechnicianStatus.AVAILABLE,
    TechnicianStatus.UNREACHABLE,
  ],
  EN_ROUTE: [
    TechnicianStatus.WORKING,
    TechnicianStatus.AVAILABLE,
    TechnicianStatus.UNREACHABLE,
  ],
  WORKING: [TechnicianStatus.AVAILABLE, TechnicianStatus.ON_BREAK, TechnicianStatus.UNREACHABLE],
  ON_BREAK: [TechnicianStatus.AVAILABLE, TechnicianStatus.OFFLINE],
  UNREACHABLE: [
    TechnicianStatus.AVAILABLE,
    TechnicianStatus.OFFLINE,
    TechnicianStatus.ONLINE,
  ],
};

export function canTransitionTechnicianStatus(
  from: TechnicianStatus,
  to: TechnicianStatus,
): boolean {
  return TECHNICIAN_STATUS_TRANSITIONS[from].includes(to);
}

export const BookingPriority = {
  STANDARD: 'STANDARD',
  PRIORITY: 'PRIORITY',
  EMERGENCY: 'EMERGENCY',
} as const;
export type BookingPriority = (typeof BookingPriority)[keyof typeof BookingPriority];

export const DispatchDecision = {
  AUTO_ASSIGNED: 'AUTO_ASSIGNED',
  MANUAL_ASSIGNED: 'MANUAL_ASSIGNED',
  REASSIGNED: 'REASSIGNED',
  RECOMMENDED: 'RECOMMENDED',
  REJECTED_BY_TECHNICIAN: 'REJECTED_BY_TECHNICIAN',
  FALLBACK_DISPATCHER: 'FALLBACK_DISPATCHER',
  CANCELLED: 'CANCELLED',
} as const;
export type DispatchDecision = (typeof DispatchDecision)[keyof typeof DispatchDecision];

export const DispatchAlertKind = {
  TECHNICIAN_DELAYED: 'TECHNICIAN_DELAYED',
  TECHNICIAN_UNREACHABLE: 'TECHNICIAN_UNREACHABLE',
  BOOKING_OVERDUE: 'BOOKING_OVERDUE',
  LOW_AVAILABILITY: 'LOW_AVAILABILITY',
  NO_CANDIDATES: 'NO_CANDIDATES',
} as const;
export type DispatchAlertKind = (typeof DispatchAlertKind)[keyof typeof DispatchAlertKind];

/** Cross-app permissions referenced by RBAC. */
export const Permission = {
  // Leads
  LEAD_CREATE: 'lead:create',
  LEAD_VIEW: 'lead:view',
  LEAD_UPDATE: 'lead:update',
  LEAD_ASSIGN: 'lead:assign',
  LEAD_DELETE: 'lead:delete',
  // Bookings
  BOOKING_READ: 'booking:read',
  BOOKING_WRITE: 'booking:write',
  BOOKING_CREATE: 'booking:create',
  BOOKING_UPDATE: 'booking:update',
  BOOKING_ASSIGN: 'booking:assign',
  BOOKING_CANCEL: 'booking:cancel',
  BOOKING_RESCHEDULE: 'booking:reschedule',
  // Customers
  CUSTOMER_READ: 'customer:read',
  CUSTOMER_WRITE: 'customer:write',
  // Technicians
  TECHNICIAN_READ: 'technician:read',
  TECHNICIAN_WRITE: 'technician:write',
  TECHNICIAN_ONBOARD: 'technician:onboard',
  TECHNICIAN_TRACK: 'technician:track',
  TECHNICIAN_LOCATION_WRITE: 'technician:location:write',
  TECHNICIAN_STATUS_WRITE: 'technician:status:write',
  // Dispatch
  DISPATCH_VIEW: 'dispatch:view',
  DISPATCH_ASSIGN: 'dispatch:assign',
  DISPATCH_OVERRIDE: 'dispatch:override',
  DISPATCH_ACKNOWLEDGE: 'dispatch:acknowledge',
  // Finance — invoice
  INVOICE_VIEW: 'invoice:view',
  INVOICE_CREATE: 'invoice:create',
  INVOICE_UPDATE: 'invoice:update',
  INVOICE_SEND: 'invoice:send',
  INVOICE_CANCEL: 'invoice:cancel',
  INVOICE_REFUND: 'invoice:refund',
  // Finance — quotation
  QUOTATION_VIEW: 'quotation:view',
  QUOTATION_CREATE: 'quotation:create',
  QUOTATION_SEND: 'quotation:send',
  QUOTATION_CONVERT: 'quotation:convert',
  // Finance — payment
  PAYMENT_VIEW: 'payment:view',
  PAYMENT_MANAGE: 'payment:manage',
  PAYMENT_REFUND: 'payment:refund',
  // Finance — AMC
  AMC_VIEW: 'amc:view',
  AMC_MANAGE: 'amc:manage',
  AMC_SUBSCRIBE: 'amc:subscribe',
  // Finance — payout
  PAYOUT_VIEW: 'payout:view',
  PAYOUT_APPROVE: 'payout:approve',
  PAYOUT_PROCESS: 'payout:process',
  // Finance — dashboards / reports / ledger
  FINANCE_VIEW: 'finance:view',
  FINANCE_REPORT_EXPORT: 'finance:report:export',
  LEDGER_VIEW: 'ledger:view',
  // Invoicing & Payments (aliases kept for backwards-compat)
  INVOICE_READ: 'invoice:read',
  INVOICE_WRITE: 'invoice:write',
  PAYMENT_READ: 'payment:read',
  // Admin
  USER_MANAGE: 'user:manage',
  ROLE_MANAGE: 'role:manage',
  ANALYTICS_VIEW: 'analytics:view',
  AUDIT_LOG_VIEW: 'audit_log:view',
  NOTIFICATION_VIEW: 'notification:view',
  NOTIFICATION_RETRY: 'notification:retry',
  WORKFLOW_VIEW: 'workflow:view',
  WORKFLOW_MANAGE: 'workflow:manage',
  AUTOMATION_MANAGE: 'automation:manage',
  CITY_MANAGE: 'city:manage',
  // Inventory
  INVENTORY_VIEW: 'inventory:view',
  INVENTORY_MANAGE: 'inventory:manage',
  INVENTORY_ADJUST: 'inventory:adjust',
  WAREHOUSE_VIEW: 'warehouse:view',
  WAREHOUSE_MANAGE: 'warehouse:manage',
  STOCK_TRANSFER_VIEW: 'stock_transfer:view',
  STOCK_TRANSFER_REQUEST: 'stock_transfer:request',
  STOCK_TRANSFER_APPROVE: 'stock_transfer:approve',
  STOCK_TRANSFER_DISPATCH: 'stock_transfer:dispatch',
  STOCK_TRANSFER_RECEIVE: 'stock_transfer:receive',
  VENDOR_VIEW: 'vendor:view',
  VENDOR_MANAGE: 'vendor:manage',
  PURCHASE_ORDER_VIEW: 'purchase_order:view',
  PURCHASE_ORDER_CREATE: 'purchase_order:create',
  PURCHASE_ORDER_APPROVE: 'purchase_order:approve',
  PURCHASE_ORDER_RECEIVE: 'purchase_order:receive',
  PURCHASE_ORDER_CANCEL: 'purchase_order:cancel',
  TECH_INVENTORY_VIEW: 'tech_inventory:view',
  TECH_INVENTORY_ALLOCATE: 'tech_inventory:allocate',
  TECH_INVENTORY_USE: 'tech_inventory:use',
  TECH_INVENTORY_RETURN: 'tech_inventory:return',
  TECH_INVENTORY_RECONCILE: 'tech_inventory:reconcile',
  INVENTORY_ALERT_VIEW: 'inventory_alert:view',
  INVENTORY_ALERT_ACKNOWLEDGE: 'inventory_alert:acknowledge',
  INVENTORY_ANALYTICS_VIEW: 'inventory_analytics:view',
  // Omnichannel Support / Ticketing / Call Center
  SUPPORT_VIEW: 'support:view',
  TICKET_VIEW: 'ticket:view',
  TICKET_CREATE: 'ticket:create',
  TICKET_UPDATE: 'ticket:update',
  TICKET_ASSIGN: 'ticket:assign',
  TICKET_ESCALATE: 'ticket:escalate',
  TICKET_CLOSE: 'ticket:close',
  TICKET_REOPEN: 'ticket:reopen',
  TICKET_DELETE: 'ticket:delete',
  TICKET_MERGE: 'ticket:merge',
  INBOX_VIEW: 'inbox:view',
  INBOX_MANAGE: 'inbox:manage',
  CONVERSATION_VIEW: 'conversation:view',
  CONVERSATION_REPLY: 'conversation:reply',
  CONVERSATION_ASSIGN: 'conversation:assign',
  CALL_VIEW: 'call:view',
  CALL_MANAGE: 'call:manage',
  CALL_MAKE: 'call:make',
  CALL_DISPOSITION: 'call:disposition',
  KB_VIEW: 'kb:view',
  KB_WRITE: 'kb:write',
  KB_PUBLISH: 'kb:publish',
  CANNED_RESPONSE_VIEW: 'canned_response:view',
  CANNED_RESPONSE_MANAGE: 'canned_response:manage',
  SLA_VIEW: 'sla:view',
  SLA_MANAGE: 'sla:manage',
  SUPPORT_ANALYTICS_VIEW: 'support_analytics:view',
  // Wildcard for super admin
  ALL: '*',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

// ============================================================================
// LEAD ENUMS
// ============================================================================

export const LeadSource = {
  WEBSITE: 'WEBSITE',
  WHATSAPP: 'WHATSAPP',
  GOOGLE_ADS: 'GOOGLE_ADS',
  FACEBOOK: 'FACEBOOK',
  INSTAGRAM: 'INSTAGRAM',
  CALL: 'CALL',
  MANUAL: 'MANUAL',
  REFERRAL: 'REFERRAL',
} as const;
export type LeadSource = (typeof LeadSource)[keyof typeof LeadSource];

export const LeadStatus = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  QUALIFIED: 'QUALIFIED',
  BOOKING_CREATED: 'BOOKING_CREATED',
  CANCELLED: 'CANCELLED',
  SPAM: 'SPAM',
} as const;
export type LeadStatus = (typeof LeadStatus)[keyof typeof LeadStatus];

export const TERMINAL_LEAD_STATUSES = new Set<LeadStatus>([
  LeadStatus.BOOKING_CREATED,
  LeadStatus.CANCELLED,
  LeadStatus.SPAM,
]);

/** Forward-only state machine for leads. */
export const LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  [LeadStatus.NEW]: [LeadStatus.CONTACTED, LeadStatus.QUALIFIED, LeadStatus.CANCELLED, LeadStatus.SPAM],
  [LeadStatus.CONTACTED]: [LeadStatus.QUALIFIED, LeadStatus.CANCELLED, LeadStatus.SPAM],
  [LeadStatus.QUALIFIED]: [LeadStatus.BOOKING_CREATED, LeadStatus.CANCELLED],
  [LeadStatus.BOOKING_CREATED]: [],
  [LeadStatus.CANCELLED]: [],
  [LeadStatus.SPAM]: [],
};

export function canTransitionLead(from: LeadStatus, to: LeadStatus): boolean {
  return LEAD_TRANSITIONS[from].includes(to);
}

export const LeadPriority = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;
export type LeadPriority = (typeof LeadPriority)[keyof typeof LeadPriority];

// ============================================================================
// ACTIVITY TYPES — shared by LeadActivity + BookingActivity
// ============================================================================

export const ActivityType = {
  CREATED: 'CREATED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  ASSIGNED: 'ASSIGNED',
  REASSIGNED: 'REASSIGNED',
  NOTE_ADDED: 'NOTE_ADDED',
  FIELD_UPDATED: 'FIELD_UPDATED',
  TAGS_UPDATED: 'TAGS_UPDATED',
  SCHEDULED: 'SCHEDULED',
  RESCHEDULED: 'RESCHEDULED',
  TECHNICIAN_EN_ROUTE: 'TECHNICIAN_EN_ROUTE',
  ARRIVED_ON_SITE: 'ARRIVED_ON_SITE',
  OTP_SENT: 'OTP_SENT',
  OTP_VERIFIED: 'OTP_VERIFIED',
  WAITING_PARTS: 'WAITING_PARTS',
  WORK_RESUMED: 'WORK_RESUMED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  ATTACHMENT_ADDED: 'ATTACHMENT_ADDED',
  SIGNATURE_CAPTURED: 'SIGNATURE_CAPTURED',
  PAYMENT_RECORDED: 'PAYMENT_RECORDED',
  CONVERTED_TO_BOOKING: 'CONVERTED_TO_BOOKING',
} as const;
export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType];

// ============================================================================
// INVENTORY / ERP ENUMS
// ============================================================================

export const InventoryItemType = {
  SPARE_PART: 'SPARE_PART',
  APPLIANCE: 'APPLIANCE',
  CONSUMABLE: 'CONSUMABLE',
  TOOL: 'TOOL',
  ACCESSORY: 'ACCESSORY',
} as const;
export type InventoryItemType = (typeof InventoryItemType)[keyof typeof InventoryItemType];

export const InventoryUnit = {
  PIECE: 'PIECE',
  SET: 'SET',
  BOX: 'BOX',
  METER: 'METER',
  KILOGRAM: 'KILOGRAM',
  LITRE: 'LITRE',
  PACK: 'PACK',
} as const;
export type InventoryUnit = (typeof InventoryUnit)[keyof typeof InventoryUnit];

export const WarehouseKind = {
  CENTRAL: 'CENTRAL',
  BRANCH: 'BRANCH',
  TRANSIT: 'TRANSIT',
  VENDOR_RETURNS: 'VENDOR_RETURNS',
  SCRAP: 'SCRAP',
} as const;
export type WarehouseKind = (typeof WarehouseKind)[keyof typeof WarehouseKind];

export const StockMovementKind = {
  IN_PURCHASE: 'IN_PURCHASE',
  IN_RETURN_VENDOR: 'IN_RETURN_VENDOR',
  IN_RETURN_TECHNICIAN: 'IN_RETURN_TECHNICIAN',
  IN_TRANSFER: 'IN_TRANSFER',
  IN_ADJUSTMENT: 'IN_ADJUSTMENT',
  IN_OPENING: 'IN_OPENING',
  OUT_SALE: 'OUT_SALE',
  OUT_TRANSFER: 'OUT_TRANSFER',
  OUT_ADJUSTMENT: 'OUT_ADJUSTMENT',
  OUT_TO_TECHNICIAN: 'OUT_TO_TECHNICIAN',
  OUT_TO_BOOKING: 'OUT_TO_BOOKING',
  OUT_SCRAP: 'OUT_SCRAP',
  RESERVE: 'RESERVE',
  RELEASE_RESERVE: 'RELEASE_RESERVE',
} as const;
export type StockMovementKind = (typeof StockMovementKind)[keyof typeof StockMovementKind];

/** Movements that move physical stock IN (positive quantity delta). */
export const STOCK_INFLOW_KINDS = new Set<StockMovementKind>([
  StockMovementKind.IN_PURCHASE,
  StockMovementKind.IN_RETURN_VENDOR,
  StockMovementKind.IN_RETURN_TECHNICIAN,
  StockMovementKind.IN_TRANSFER,
  StockMovementKind.IN_ADJUSTMENT,
  StockMovementKind.IN_OPENING,
]);

/** Movements that take physical stock OUT (negative quantity delta). */
export const STOCK_OUTFLOW_KINDS = new Set<StockMovementKind>([
  StockMovementKind.OUT_SALE,
  StockMovementKind.OUT_TRANSFER,
  StockMovementKind.OUT_ADJUSTMENT,
  StockMovementKind.OUT_TO_TECHNICIAN,
  StockMovementKind.OUT_TO_BOOKING,
  StockMovementKind.OUT_SCRAP,
]);

export const StockTransferStatus = {
  DRAFT: 'DRAFT',
  REQUESTED: 'REQUESTED',
  APPROVED: 'APPROVED',
  IN_TRANSIT: 'IN_TRANSIT',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
  REJECTED: 'REJECTED',
} as const;
export type StockTransferStatus = (typeof StockTransferStatus)[keyof typeof StockTransferStatus];

/** Forward-only state machine for stock transfers. */
export const STOCK_TRANSFER_TRANSITIONS: Record<StockTransferStatus, StockTransferStatus[]> = {
  [StockTransferStatus.DRAFT]: [
    StockTransferStatus.REQUESTED,
    StockTransferStatus.CANCELLED,
  ],
  [StockTransferStatus.REQUESTED]: [
    StockTransferStatus.APPROVED,
    StockTransferStatus.REJECTED,
    StockTransferStatus.CANCELLED,
  ],
  [StockTransferStatus.APPROVED]: [
    StockTransferStatus.IN_TRANSIT,
    StockTransferStatus.CANCELLED,
  ],
  [StockTransferStatus.IN_TRANSIT]: [StockTransferStatus.RECEIVED],
  [StockTransferStatus.RECEIVED]: [],
  [StockTransferStatus.CANCELLED]: [],
  [StockTransferStatus.REJECTED]: [],
};

export const PurchaseOrderStatus = {
  DRAFT: 'DRAFT',
  AWAITING_APPROVAL: 'AWAITING_APPROVAL',
  APPROVED: 'APPROVED',
  ORDERED: 'ORDERED',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
  CLOSED: 'CLOSED',
} as const;
export type PurchaseOrderStatus = (typeof PurchaseOrderStatus)[keyof typeof PurchaseOrderStatus];

export const PURCHASE_ORDER_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  [PurchaseOrderStatus.DRAFT]: [
    PurchaseOrderStatus.AWAITING_APPROVAL,
    PurchaseOrderStatus.APPROVED,
    PurchaseOrderStatus.CANCELLED,
  ],
  [PurchaseOrderStatus.AWAITING_APPROVAL]: [
    PurchaseOrderStatus.APPROVED,
    PurchaseOrderStatus.CANCELLED,
  ],
  [PurchaseOrderStatus.APPROVED]: [
    PurchaseOrderStatus.ORDERED,
    PurchaseOrderStatus.CANCELLED,
  ],
  [PurchaseOrderStatus.ORDERED]: [
    PurchaseOrderStatus.PARTIALLY_RECEIVED,
    PurchaseOrderStatus.RECEIVED,
    PurchaseOrderStatus.CANCELLED,
  ],
  [PurchaseOrderStatus.PARTIALLY_RECEIVED]: [
    PurchaseOrderStatus.RECEIVED,
    PurchaseOrderStatus.CLOSED,
    PurchaseOrderStatus.CANCELLED,
  ],
  [PurchaseOrderStatus.RECEIVED]: [PurchaseOrderStatus.CLOSED],
  [PurchaseOrderStatus.CANCELLED]: [],
  [PurchaseOrderStatus.CLOSED]: [],
};

export const GoodsReceiptStatus = {
  DRAFT: 'DRAFT',
  POSTED: 'POSTED',
  CANCELLED: 'CANCELLED',
} as const;
export type GoodsReceiptStatus = (typeof GoodsReceiptStatus)[keyof typeof GoodsReceiptStatus];

export const VendorStatus = {
  ACTIVE: 'ACTIVE',
  BLACKLISTED: 'BLACKLISTED',
  ON_HOLD: 'ON_HOLD',
  PROSPECT: 'PROSPECT',
} as const;
export type VendorStatus = (typeof VendorStatus)[keyof typeof VendorStatus];

export const TechnicianStockStatus = {
  ALLOCATED: 'ALLOCATED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  USED: 'USED',
  RETURNED: 'RETURNED',
  RECONCILED: 'RECONCILED',
} as const;
export type TechnicianStockStatus = (typeof TechnicianStockStatus)[keyof typeof TechnicianStockStatus];

export const InventoryAlertKind = {
  LOW_STOCK: 'LOW_STOCK',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  EXPIRING_SOON: 'EXPIRING_SOON',
  EXPIRED: 'EXPIRED',
  SLOW_MOVING: 'SLOW_MOVING',
  DEAD_STOCK: 'DEAD_STOCK',
  TECHNICIAN_MISMATCH: 'TECHNICIAN_MISMATCH',
  PENDING_TRANSFER: 'PENDING_TRANSFER',
  OVERDUE_PO: 'OVERDUE_PO',
  NEGATIVE_STOCK: 'NEGATIVE_STOCK',
} as const;
export type InventoryAlertKind = (typeof InventoryAlertKind)[keyof typeof InventoryAlertKind];

export const InventoryAlertSeverity = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
} as const;
export type InventoryAlertSeverity = (typeof InventoryAlertSeverity)[keyof typeof InventoryAlertSeverity];

export const InventoryAlertStatus = {
  OPEN: 'OPEN',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  RESOLVED: 'RESOLVED',
  SNOOZED: 'SNOOZED',
} as const;
export type InventoryAlertStatus = (typeof InventoryAlertStatus)[keyof typeof InventoryAlertStatus];

// ============================================================================
// OMNICHANNEL SUPPORT / TICKETING / CALL CENTER ENUMS
// ============================================================================

export const TicketStatus = {
  OPEN: 'OPEN',
  PENDING: 'PENDING',
  WAITING_CUSTOMER: 'WAITING_CUSTOMER',
  ON_HOLD: 'ON_HOLD',
  ESCALATED: 'ESCALATED',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

/** Tickets in these statuses are "open" for the purpose of dashboards / SLA. */
export const OPEN_TICKET_STATUSES = new Set<TicketStatus>([
  TicketStatus.OPEN,
  TicketStatus.PENDING,
  TicketStatus.WAITING_CUSTOMER,
  TicketStatus.ON_HOLD,
  TicketStatus.ESCALATED,
]);

/** Forward-only state machine for tickets. Reopen is a controlled exception. */
export const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  [TicketStatus.OPEN]: [
    TicketStatus.PENDING,
    TicketStatus.WAITING_CUSTOMER,
    TicketStatus.ON_HOLD,
    TicketStatus.ESCALATED,
    TicketStatus.RESOLVED,
    TicketStatus.CLOSED,
  ],
  [TicketStatus.PENDING]: [
    TicketStatus.OPEN,
    TicketStatus.WAITING_CUSTOMER,
    TicketStatus.ON_HOLD,
    TicketStatus.ESCALATED,
    TicketStatus.RESOLVED,
    TicketStatus.CLOSED,
  ],
  [TicketStatus.WAITING_CUSTOMER]: [
    TicketStatus.OPEN,
    TicketStatus.PENDING,
    TicketStatus.ON_HOLD,
    TicketStatus.ESCALATED,
    TicketStatus.RESOLVED,
    TicketStatus.CLOSED,
  ],
  [TicketStatus.ON_HOLD]: [
    TicketStatus.OPEN,
    TicketStatus.PENDING,
    TicketStatus.ESCALATED,
    TicketStatus.RESOLVED,
    TicketStatus.CLOSED,
  ],
  [TicketStatus.ESCALATED]: [
    TicketStatus.OPEN,
    TicketStatus.PENDING,
    TicketStatus.RESOLVED,
    TicketStatus.CLOSED,
  ],
  [TicketStatus.RESOLVED]: [TicketStatus.OPEN, TicketStatus.CLOSED],
  [TicketStatus.CLOSED]: [TicketStatus.OPEN],
};

export function canTransitionTicket(from: TicketStatus, to: TicketStatus): boolean {
  return TICKET_TRANSITIONS[from]?.includes(to) ?? false;
}

export const TicketPriority = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;
export type TicketPriority = (typeof TicketPriority)[keyof typeof TicketPriority];

export const TICKET_PRIORITY_RANK: Record<TicketPriority, number> = {
  [TicketPriority.LOW]: 1,
  [TicketPriority.NORMAL]: 2,
  [TicketPriority.HIGH]: 3,
  [TicketPriority.URGENT]: 4,
};

export const TicketSource = {
  WHATSAPP: 'WHATSAPP',
  EMAIL: 'EMAIL',
  PHONE: 'PHONE',
  WEB_CHAT: 'WEB_CHAT',
  IN_APP_CHAT: 'IN_APP_CHAT',
  SMS: 'SMS',
  WALK_IN: 'WALK_IN',
  SOCIAL: 'SOCIAL',
  MANUAL: 'MANUAL',
} as const;
export type TicketSource = (typeof TicketSource)[keyof typeof TicketSource];

export const TicketAuthorKind = {
  CUSTOMER: 'CUSTOMER',
  AGENT: 'AGENT',
  SYSTEM: 'SYSTEM',
  BOT: 'BOT',
} as const;
export type TicketAuthorKind = (typeof TicketAuthorKind)[keyof typeof TicketAuthorKind];

export const TicketActivityType = {
  CREATED: 'CREATED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  PRIORITY_CHANGED: 'PRIORITY_CHANGED',
  ASSIGNED: 'ASSIGNED',
  REASSIGNED: 'REASSIGNED',
  ESCALATED: 'ESCALATED',
  DE_ESCALATED: 'DE_ESCALATED',
  NOTE_ADDED: 'NOTE_ADDED',
  REPLY_SENT: 'REPLY_SENT',
  ATTACHMENT_ADDED: 'ATTACHMENT_ADDED',
  TAGS_UPDATED: 'TAGS_UPDATED',
  MERGED: 'MERGED',
  SPLIT: 'SPLIT',
  RESOLVED: 'RESOLVED',
  REOPENED: 'REOPENED',
  CLOSED: 'CLOSED',
  SLA_BREACH_WARNING: 'SLA_BREACH_WARNING',
  SLA_BREACHED: 'SLA_BREACHED',
  CSAT_RECORDED: 'CSAT_RECORDED',
} as const;
export type TicketActivityType = (typeof TicketActivityType)[keyof typeof TicketActivityType];

export const ConversationChannel = {
  WHATSAPP: 'WHATSAPP',
  EMAIL: 'EMAIL',
  PHONE: 'PHONE',
  WEB_CHAT: 'WEB_CHAT',
  IN_APP_CHAT: 'IN_APP_CHAT',
  SMS: 'SMS',
  SOCIAL: 'SOCIAL',
} as const;
export type ConversationChannel = (typeof ConversationChannel)[keyof typeof ConversationChannel];

export const ConversationStatus = {
  OPEN: 'OPEN',
  PENDING: 'PENDING',
  WAITING_CUSTOMER: 'WAITING_CUSTOMER',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type ConversationStatus = (typeof ConversationStatus)[keyof typeof ConversationStatus];

export const MessageDirection = {
  INBOUND: 'INBOUND',
  OUTBOUND: 'OUTBOUND',
} as const;
export type MessageDirection = (typeof MessageDirection)[keyof typeof MessageDirection];

export const MessageStatus = {
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  FAILED: 'FAILED',
} as const;
export type MessageStatus = (typeof MessageStatus)[keyof typeof MessageStatus];

export const CallDirection = {
  INBOUND: 'INBOUND',
  OUTBOUND: 'OUTBOUND',
} as const;
export type CallDirection = (typeof CallDirection)[keyof typeof CallDirection];

export const CallStatus = {
  QUEUED: 'QUEUED',
  RINGING: 'RINGING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  MISSED: 'MISSED',
  NO_ANSWER: 'NO_ANSWER',
  BUSY: 'BUSY',
  FAILED: 'FAILED',
  ABANDONED: 'ABANDONED',
  VOICEMAIL: 'VOICEMAIL',
} as const;
export type CallStatus = (typeof CallStatus)[keyof typeof CallStatus];

/** Calls that count as "missed" for the recovery queue. */
export const MISSED_CALL_STATUSES = new Set<CallStatus>([
  CallStatus.MISSED,
  CallStatus.NO_ANSWER,
  CallStatus.BUSY,
  CallStatus.ABANDONED,
  CallStatus.VOICEMAIL,
]);

export const CallDisposition = {
  RESOLVED: 'RESOLVED',
  CALLBACK_REQUESTED: 'CALLBACK_REQUESTED',
  WRONG_NUMBER: 'WRONG_NUMBER',
  SPAM: 'SPAM',
  COMPLAINT: 'COMPLAINT',
  BOOKING_CREATED: 'BOOKING_CREATED',
  FOLLOWUP_NEEDED: 'FOLLOWUP_NEEDED',
  NOT_INTERESTED: 'NOT_INTERESTED',
  TECHNICAL_ISSUE: 'TECHNICAL_ISSUE',
  OTHER: 'OTHER',
} as const;
export type CallDisposition = (typeof CallDisposition)[keyof typeof CallDisposition];

export const SlaTargetKind = {
  FIRST_RESPONSE: 'FIRST_RESPONSE',
  RESOLUTION: 'RESOLUTION',
  NEXT_RESPONSE: 'NEXT_RESPONSE',
} as const;
export type SlaTargetKind = (typeof SlaTargetKind)[keyof typeof SlaTargetKind];

export const KbArticleStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type KbArticleStatus = (typeof KbArticleStatus)[keyof typeof KbArticleStatus];

export const KbVisibility = {
  PUBLIC: 'PUBLIC',
  INTERNAL: 'INTERNAL',
  CUSTOMER_AUTHENTICATED: 'CUSTOMER_AUTHENTICATED',
} as const;
export type KbVisibility = (typeof KbVisibility)[keyof typeof KbVisibility];

export const CannedResponseScope = {
  GLOBAL: 'GLOBAL',
  TEAM: 'TEAM',
  PRIVATE: 'PRIVATE',
} as const;
export type CannedResponseScope = (typeof CannedResponseScope)[keyof typeof CannedResponseScope];
