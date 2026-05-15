/**
 * Domain events broadcast over Redis pub/sub & websockets. Keeping the names
 * and payload shapes here ensures producers and consumers stay in sync.
 */
import type { BookingId, CustomerId, GeoPoint, InvoiceId, TechnicianId, UserId } from '../common';
import type {
  AMCSubscriptionId,
  AMCVisitId,
  CreditNoteId,
  DispatchAssignmentId,
  LeadId,
  PaymentTransactionId,
  QuotationId,
  RefundId,
  TechnicianPayoutId,
} from '../entities';
import type {
  AMCSubscriptionStatus,
  BookingStatus,
  CallDirection,
  CallDisposition,
  CallStatus,
  ConversationChannel,
  ConversationStatus,
  DispatchAlertKind,
  InventoryAlertKind,
  InventoryAlertSeverity,
  LeadStatus,
  MessageDirection,
  MessageStatus,
  PaymentMethod,
  PurchaseOrderStatus,
  RefundStatus,
  SlaTargetKind,
  StockMovementKind,
  TechnicianStatus,
  TechnicianStockStatus,
  TicketAuthorKind,
  TicketPriority,
  TicketSource,
  TicketStatus,
} from '../enums';

export const DomainEventName = {
  LeadCreated: 'lead.created',
  LeadAssigned: 'lead.assigned',
  LeadStatusChanged: 'lead.status_changed',
  LeadConverted: 'lead.converted',
  LeadNoteAdded: 'lead.note_added',
  BookingCreated: 'booking.created',
  BookingAssigned: 'booking.assigned',
  BookingStatusChanged: 'booking.status_changed',
  BookingRescheduled: 'booking.rescheduled',
  BookingCancelled: 'booking.cancelled',
  BookingCompleted: 'booking.completed',
  BookingOtpSent: 'booking.otp_sent',
  BookingOtpVerified: 'booking.otp_verified',
  BookingNoteAdded: 'booking.note_added',
  BookingAttachmentAdded: 'booking.attachment_added',
  TechnicianLocationUpdated: 'technician.location_updated',
  TechnicianStatusChanged: 'technician.status_changed',
  TechnicianOnline: 'technician.online',
  TechnicianOffline: 'technician.offline',
  TechnicianArrived: 'technician.arrived',
  TechnicianDelayed: 'technician.delayed',
  TechnicianUnreachable: 'technician.unreachable',
  TechnicianJobAccepted: 'technician.job_accepted',
  TechnicianJobRejected: 'technician.job_rejected',
  DispatchAutoAssigned: 'dispatch.auto_assigned',
  DispatchManualAssigned: 'dispatch.manual_assigned',
  DispatchReassigned: 'dispatch.reassigned',
  DispatchNoCandidates: 'dispatch.no_candidates',
  DispatchAlertRaised: 'dispatch.alert_raised',
  DispatchAlertAcknowledged: 'dispatch.alert_acknowledged',
  // Finance — invoice
  InvoiceCreated: 'invoice.created',
  InvoiceSent: 'invoice.sent',
  InvoicePaid: 'invoice.paid',
  InvoicePartiallyPaid: 'invoice.partially_paid',
  InvoiceCancelled: 'invoice.cancelled',
  InvoiceOverdue: 'invoice.overdue',
  InvoiceRefunded: 'invoice.refunded',
  // Finance — quotation
  QuotationCreated: 'quotation.created',
  QuotationSent: 'quotation.sent',
  QuotationViewed: 'quotation.viewed',
  QuotationApproved: 'quotation.approved',
  QuotationRejected: 'quotation.rejected',
  QuotationConverted: 'quotation.converted',
  QuotationExpired: 'quotation.expired',
  // Finance — payment
  PaymentLinkCreated: 'payment.link_created',
  PaymentSucceeded: 'payment.succeeded',
  PaymentFailed: 'payment.failed',
  PaymentRefunded: 'payment.refunded',
  // Finance — AMC
  AmcSubscriptionCreated: 'amc.subscription_created',
  AmcSubscriptionActivated: 'amc.subscription_activated',
  AmcSubscriptionRenewed: 'amc.subscription_renewed',
  AmcSubscriptionCancelled: 'amc.subscription_cancelled',
  AmcSubscriptionExpiringSoon: 'amc.subscription_expiring_soon',
  AmcVisitScheduled: 'amc.visit_scheduled',
  AmcVisitMissed: 'amc.visit_missed',
  AmcVisitCompleted: 'amc.visit_completed',
  // Finance — payout
  PayoutCreated: 'payout.created',
  PayoutApproved: 'payout.approved',
  PayoutPaid: 'payout.paid',
  PayoutFailed: 'payout.failed',
  // Finance — credit note
  CreditNoteIssued: 'credit_note.issued',
  PaymentCaptured: 'payment.captured',
  NotificationDelivered: 'notification.delivered',
  UserRegistered: 'user.registered',
  // Inventory / ERP
  InventoryStockUpdated: 'inventory.stock_updated',
  InventoryItemCreated: 'inventory.item_created',
  InventoryAlertRaised: 'inventory.alert_raised',
  InventoryAlertResolved: 'inventory.alert_resolved',
  StockTransferRequested: 'inventory.transfer_requested',
  StockTransferApproved: 'inventory.transfer_approved',
  StockTransferDispatched: 'inventory.transfer_dispatched',
  StockTransferReceived: 'inventory.transfer_received',
  StockTransferCancelled: 'inventory.transfer_cancelled',
  PurchaseOrderCreated: 'inventory.po_created',
  PurchaseOrderApproved: 'inventory.po_approved',
  PurchaseOrderOrdered: 'inventory.po_ordered',
  PurchaseOrderReceived: 'inventory.po_received',
  PurchaseOrderCancelled: 'inventory.po_cancelled',
  GoodsReceiptPosted: 'inventory.grn_posted',
  TechnicianStockAllocated: 'inventory.tech_stock_allocated',
  TechnicianStockAcknowledged: 'inventory.tech_stock_acknowledged',
  TechnicianStockUsed: 'inventory.tech_stock_used',
  TechnicianStockReturned: 'inventory.tech_stock_returned',
  TechnicianStockReconciled: 'inventory.tech_stock_reconciled',
  // Omnichannel Support / Ticketing
  TicketCreated: 'ticket.created',
  TicketAssigned: 'ticket.assigned',
  TicketStatusChanged: 'ticket.status_changed',
  TicketPriorityChanged: 'ticket.priority_changed',
  TicketEscalated: 'ticket.escalated',
  TicketResolved: 'ticket.resolved',
  TicketReopened: 'ticket.reopened',
  TicketClosed: 'ticket.closed',
  TicketMerged: 'ticket.merged',
  TicketNoteAdded: 'ticket.note_added',
  TicketReplySent: 'ticket.reply_sent',
  TicketFirstResponseRecorded: 'ticket.first_response_recorded',
  TicketSlaBreachWarning: 'ticket.sla_breach_warning',
  TicketSlaBreached: 'ticket.sla_breached',
  TicketCsatRecorded: 'ticket.csat_recorded',
  // Conversations / messages
  ConversationCreated: 'conversation.created',
  ConversationAssigned: 'conversation.assigned',
  ConversationStatusChanged: 'conversation.status_changed',
  ConversationMessageReceived: 'conversation.message_received',
  ConversationMessageSent: 'conversation.message_sent',
  ConversationMessageStatusUpdated: 'conversation.message_status_updated',
  ConversationTyping: 'conversation.typing',
  ConversationReadReceipt: 'conversation.read_receipt',
  // Calls
  CallIncoming: 'call.incoming',
  CallAnswered: 'call.answered',
  CallCompleted: 'call.completed',
  CallMissed: 'call.missed',
  CallDispositionSet: 'call.disposition_set',
  CallRecordingReady: 'call.recording_ready',
} as const;
export type DomainEventName = (typeof DomainEventName)[keyof typeof DomainEventName];

export interface DomainEvent<T extends DomainEventName, P> {
  id: string;
  name: T;
  occurredAt: string;
  actorId: UserId | null;
  payload: P;
}

export type BookingCreatedEvent = DomainEvent<
  typeof DomainEventName.BookingCreated,
  { bookingId: BookingId; customerId: CustomerId }
>;

export type BookingAssignedEvent = DomainEvent<
  typeof DomainEventName.BookingAssigned,
  { bookingId: BookingId; technicianId: TechnicianId }
>;

export type BookingStatusChangedEvent = DomainEvent<
  typeof DomainEventName.BookingStatusChanged,
  { bookingId: BookingId; from: BookingStatus; to: BookingStatus }
>;

export type TechnicianLocationUpdatedEvent = DomainEvent<
  typeof DomainEventName.TechnicianLocationUpdated,
  { technicianId: TechnicianId; location: GeoPoint; recordedAt: string }
>;

export type TechnicianStatusChangedEvent = DomainEvent<
  typeof DomainEventName.TechnicianStatusChanged,
  { technicianId: TechnicianId; status: TechnicianStatus }
>;

export type BookingRescheduledEvent = DomainEvent<
  typeof DomainEventName.BookingRescheduled,
  { bookingId: BookingId; fromAt: string; toAt: string; reason: string | null }
>;

export type BookingCancelledEvent = DomainEvent<
  typeof DomainEventName.BookingCancelled,
  { bookingId: BookingId; reason: string | null }
>;

export type BookingCompletedEvent = DomainEvent<
  typeof DomainEventName.BookingCompleted,
  { bookingId: BookingId; technicianId: TechnicianId | null; finalAmountMinor: number | null }
>;

export type BookingOtpSentEvent = DomainEvent<
  typeof DomainEventName.BookingOtpSent,
  { bookingId: BookingId; expiresAt: string }
>;

export type BookingOtpVerifiedEvent = DomainEvent<
  typeof DomainEventName.BookingOtpVerified,
  { bookingId: BookingId }
>;

// Lead domain events
export type LeadCreatedEvent = DomainEvent<
  typeof DomainEventName.LeadCreated,
  { leadId: LeadId; source: string }
>;

export type LeadAssignedEvent = DomainEvent<
  typeof DomainEventName.LeadAssigned,
  { leadId: LeadId; assignedUserId: UserId }
>;

export type LeadStatusChangedEvent = DomainEvent<
  typeof DomainEventName.LeadStatusChanged,
  { leadId: LeadId; from: LeadStatus; to: LeadStatus }
>;

export type LeadConvertedEvent = DomainEvent<
  typeof DomainEventName.LeadConverted,
  { leadId: LeadId; bookingId: BookingId }
>;

export type LeadNoteAddedEvent = DomainEvent<
  typeof DomainEventName.LeadNoteAdded,
  { leadId: LeadId; noteId: string }
>;

// Dispatch + live-tracking events
export type TechnicianOnlineEvent = DomainEvent<
  typeof DomainEventName.TechnicianOnline,
  { technicianId: TechnicianId; cityId: string }
>;

export type TechnicianOfflineEvent = DomainEvent<
  typeof DomainEventName.TechnicianOffline,
  { technicianId: TechnicianId; cityId: string; reason: 'manual' | 'timeout' }
>;

export type TechnicianArrivedEvent = DomainEvent<
  typeof DomainEventName.TechnicianArrived,
  { technicianId: TechnicianId; bookingId: BookingId; arrivedAt: string }
>;

export type TechnicianDelayedEvent = DomainEvent<
  typeof DomainEventName.TechnicianDelayed,
  { technicianId: TechnicianId; bookingId: BookingId; minutesLate: number; etaIso: string }
>;

export type TechnicianUnreachableEvent = DomainEvent<
  typeof DomainEventName.TechnicianUnreachable,
  { technicianId: TechnicianId; lastSeenAt: string }
>;

export type TechnicianJobAcceptedEvent = DomainEvent<
  typeof DomainEventName.TechnicianJobAccepted,
  { technicianId: TechnicianId; bookingId: BookingId }
>;

export type TechnicianJobRejectedEvent = DomainEvent<
  typeof DomainEventName.TechnicianJobRejected,
  { technicianId: TechnicianId; bookingId: BookingId; reason: string | null }
>;

export type DispatchAutoAssignedEvent = DomainEvent<
  typeof DomainEventName.DispatchAutoAssigned,
  {
    bookingId: BookingId;
    technicianId: TechnicianId;
    score: number;
    assignmentId: DispatchAssignmentId;
  }
>;

export type DispatchManualAssignedEvent = DomainEvent<
  typeof DomainEventName.DispatchManualAssigned,
  { bookingId: BookingId; technicianId: TechnicianId; assignmentId: DispatchAssignmentId }
>;

export type DispatchReassignedEvent = DomainEvent<
  typeof DomainEventName.DispatchReassigned,
  {
    bookingId: BookingId;
    fromTechnicianId: TechnicianId | null;
    toTechnicianId: TechnicianId;
    reason: string | null;
    assignmentId: DispatchAssignmentId;
  }
>;

export type DispatchNoCandidatesEvent = DomainEvent<
  typeof DomainEventName.DispatchNoCandidates,
  { bookingId: BookingId; cityId: string }
>;

export type DispatchAlertRaisedEvent = DomainEvent<
  typeof DomainEventName.DispatchAlertRaised,
  {
    alertId: string;
    kind: DispatchAlertKind;
    severity: 'info' | 'warning' | 'critical';
    technicianId: TechnicianId | null;
    bookingId: BookingId | null;
    cityId: string | null;
    message: string;
  }
>;

export type DispatchAlertAcknowledgedEvent = DomainEvent<
  typeof DomainEventName.DispatchAlertAcknowledged,
  { alertId: string; acknowledgedBy: UserId }
>;

// ---------------- Finance ----------------

export type InvoiceCreatedEvent = DomainEvent<
  typeof DomainEventName.InvoiceCreated,
  { invoiceId: InvoiceId; customerId: CustomerId; totalMinor: number; bookingId: BookingId | null }
>;

export type InvoiceSentEvent = DomainEvent<
  typeof DomainEventName.InvoiceSent,
  { invoiceId: InvoiceId; customerId: CustomerId }
>;

export type InvoicePaidEvent = DomainEvent<
  typeof DomainEventName.InvoicePaid,
  { invoiceId: InvoiceId; customerId: CustomerId; paidAmountMinor: number }
>;

export type InvoicePartiallyPaidEvent = DomainEvent<
  typeof DomainEventName.InvoicePartiallyPaid,
  { invoiceId: InvoiceId; amountPaidMinor: number; dueAmountMinor: number }
>;

export type InvoiceCancelledEvent = DomainEvent<
  typeof DomainEventName.InvoiceCancelled,
  { invoiceId: InvoiceId; reason: string | null }
>;

export type InvoiceOverdueEvent = DomainEvent<
  typeof DomainEventName.InvoiceOverdue,
  { invoiceId: InvoiceId; customerId: CustomerId; dueAmountMinor: number; daysOverdue: number }
>;

export type InvoiceRefundedEvent = DomainEvent<
  typeof DomainEventName.InvoiceRefunded,
  { invoiceId: InvoiceId; refundId: RefundId; amountMinor: number }
>;

export type QuotationCreatedEvent = DomainEvent<
  typeof DomainEventName.QuotationCreated,
  { quotationId: QuotationId; customerId: CustomerId }
>;

export type QuotationSentEvent = DomainEvent<
  typeof DomainEventName.QuotationSent,
  { quotationId: QuotationId; customerId: CustomerId }
>;

export type QuotationViewedEvent = DomainEvent<
  typeof DomainEventName.QuotationViewed,
  { quotationId: QuotationId; viewedAt: string }
>;

export type QuotationApprovedEvent = DomainEvent<
  typeof DomainEventName.QuotationApproved,
  { quotationId: QuotationId; customerId: CustomerId }
>;

export type QuotationRejectedEvent = DomainEvent<
  typeof DomainEventName.QuotationRejected,
  { quotationId: QuotationId; reason: string | null }
>;

export type QuotationConvertedEvent = DomainEvent<
  typeof DomainEventName.QuotationConverted,
  { quotationId: QuotationId; invoiceId: InvoiceId }
>;

export type QuotationExpiredEvent = DomainEvent<
  typeof DomainEventName.QuotationExpired,
  { quotationId: QuotationId }
>;

export type PaymentLinkCreatedEvent = DomainEvent<
  typeof DomainEventName.PaymentLinkCreated,
  {
    transactionId: PaymentTransactionId;
    invoiceId: InvoiceId | null;
    customerId: CustomerId;
    hostedLink: string | null;
    provider: 'razorpay' | 'stripe' | 'manual';
  }
>;

export type PaymentSucceededEvent = DomainEvent<
  typeof DomainEventName.PaymentSucceeded,
  {
    transactionId: PaymentTransactionId;
    invoiceId: InvoiceId | null;
    customerId: CustomerId;
    amountMinor: number;
    method: PaymentMethod;
  }
>;

export type PaymentFailedEvent = DomainEvent<
  typeof DomainEventName.PaymentFailed,
  {
    transactionId: PaymentTransactionId;
    invoiceId: InvoiceId | null;
    customerId: CustomerId;
    reason: string | null;
  }
>;

export type PaymentRefundedEvent = DomainEvent<
  typeof DomainEventName.PaymentRefunded,
  {
    refundId: RefundId;
    invoiceId: InvoiceId | null;
    customerId: CustomerId;
    amountMinor: number;
    status: RefundStatus;
  }
>;

export type AmcSubscriptionCreatedEvent = DomainEvent<
  typeof DomainEventName.AmcSubscriptionCreated,
  { subscriptionId: AMCSubscriptionId; customerId: CustomerId }
>;

export type AmcSubscriptionActivatedEvent = DomainEvent<
  typeof DomainEventName.AmcSubscriptionActivated,
  { subscriptionId: AMCSubscriptionId; customerId: CustomerId; status: AMCSubscriptionStatus }
>;

export type AmcSubscriptionRenewedEvent = DomainEvent<
  typeof DomainEventName.AmcSubscriptionRenewed,
  { subscriptionId: AMCSubscriptionId; newEndsAt: string }
>;

export type AmcSubscriptionCancelledEvent = DomainEvent<
  typeof DomainEventName.AmcSubscriptionCancelled,
  { subscriptionId: AMCSubscriptionId; reason: string | null }
>;

export type AmcSubscriptionExpiringSoonEvent = DomainEvent<
  typeof DomainEventName.AmcSubscriptionExpiringSoon,
  { subscriptionId: AMCSubscriptionId; customerId: CustomerId; daysUntilExpiry: number }
>;

export type AmcVisitScheduledEvent = DomainEvent<
  typeof DomainEventName.AmcVisitScheduled,
  { visitId: AMCVisitId; subscriptionId: AMCSubscriptionId; scheduledFor: string }
>;

export type AmcVisitMissedEvent = DomainEvent<
  typeof DomainEventName.AmcVisitMissed,
  { visitId: AMCVisitId; subscriptionId: AMCSubscriptionId }
>;

export type AmcVisitCompletedEvent = DomainEvent<
  typeof DomainEventName.AmcVisitCompleted,
  { visitId: AMCVisitId; subscriptionId: AMCSubscriptionId; bookingId: BookingId | null }
>;

export type PayoutCreatedEvent = DomainEvent<
  typeof DomainEventName.PayoutCreated,
  { payoutId: TechnicianPayoutId; technicianId: TechnicianId; netMinor: number }
>;

export type PayoutApprovedEvent = DomainEvent<
  typeof DomainEventName.PayoutApproved,
  { payoutId: TechnicianPayoutId; approvedBy: UserId }
>;

export type PayoutPaidEvent = DomainEvent<
  typeof DomainEventName.PayoutPaid,
  { payoutId: TechnicianPayoutId; netMinor: number }
>;

export type PayoutFailedEvent = DomainEvent<
  typeof DomainEventName.PayoutFailed,
  { payoutId: TechnicianPayoutId; reason: string | null }
>;

export type CreditNoteIssuedEvent = DomainEvent<
  typeof DomainEventName.CreditNoteIssued,
  { creditNoteId: CreditNoteId; customerId: CustomerId; amountMinor: number }
>;

// ----------------------------------------------------------------------------
// INVENTORY EVENTS
// ----------------------------------------------------------------------------

export type InventoryStockUpdatedEvent = DomainEvent<
  typeof DomainEventName.InventoryStockUpdated,
  {
    itemId: string;
    warehouseId: string;
    kind: StockMovementKind;
    quantityDelta: number;
    runningQuantity: number;
    runningReserved: number;
  }
>;

export type InventoryItemCreatedEvent = DomainEvent<
  typeof DomainEventName.InventoryItemCreated,
  { itemId: string; sku: string; name: string }
>;

export type InventoryAlertRaisedEvent = DomainEvent<
  typeof DomainEventName.InventoryAlertRaised,
  {
    alertId: string;
    kind: InventoryAlertKind;
    severity: InventoryAlertSeverity;
    itemId: string | null;
    warehouseId: string | null;
    title: string;
  }
>;

export type InventoryAlertResolvedEvent = DomainEvent<
  typeof DomainEventName.InventoryAlertResolved,
  { alertId: string }
>;

export type StockTransferRequestedEvent = DomainEvent<
  typeof DomainEventName.StockTransferRequested,
  { transferId: string; sourceWarehouseId: string; destWarehouseId: string }
>;

export type StockTransferApprovedEvent = DomainEvent<
  typeof DomainEventName.StockTransferApproved,
  { transferId: string }
>;

export type StockTransferDispatchedEvent = DomainEvent<
  typeof DomainEventName.StockTransferDispatched,
  { transferId: string }
>;

export type StockTransferReceivedEvent = DomainEvent<
  typeof DomainEventName.StockTransferReceived,
  { transferId: string }
>;

export type StockTransferCancelledEvent = DomainEvent<
  typeof DomainEventName.StockTransferCancelled,
  { transferId: string; reason: string | null }
>;

export type PurchaseOrderCreatedEvent = DomainEvent<
  typeof DomainEventName.PurchaseOrderCreated,
  { purchaseOrderId: string; vendorId: string; totalMinor: number }
>;

export type PurchaseOrderApprovedEvent = DomainEvent<
  typeof DomainEventName.PurchaseOrderApproved,
  { purchaseOrderId: string }
>;

export type PurchaseOrderOrderedEvent = DomainEvent<
  typeof DomainEventName.PurchaseOrderOrdered,
  { purchaseOrderId: string }
>;

export type PurchaseOrderReceivedEvent = DomainEvent<
  typeof DomainEventName.PurchaseOrderReceived,
  { purchaseOrderId: string; status: PurchaseOrderStatus }
>;

export type PurchaseOrderCancelledEvent = DomainEvent<
  typeof DomainEventName.PurchaseOrderCancelled,
  { purchaseOrderId: string; reason: string | null }
>;

export type GoodsReceiptPostedEvent = DomainEvent<
  typeof DomainEventName.GoodsReceiptPosted,
  { goodsReceiptId: string; purchaseOrderId: string; warehouseId: string }
>;

export type TechnicianStockAllocatedEvent = DomainEvent<
  typeof DomainEventName.TechnicianStockAllocated,
  {
    allocationId: string;
    technicianId: TechnicianId;
    itemId: string;
    quantity: number;
    bookingId: BookingId | null;
  }
>;

export type TechnicianStockAcknowledgedEvent = DomainEvent<
  typeof DomainEventName.TechnicianStockAcknowledged,
  { allocationId: string; technicianId: TechnicianId }
>;

export type TechnicianStockUsedEvent = DomainEvent<
  typeof DomainEventName.TechnicianStockUsed,
  {
    allocationId: string;
    technicianId: TechnicianId;
    itemId: string;
    usedQty: number;
    bookingId: BookingId | null;
  }
>;

export type TechnicianStockReturnedEvent = DomainEvent<
  typeof DomainEventName.TechnicianStockReturned,
  {
    allocationId: string;
    technicianId: TechnicianId;
    itemId: string;
    returnedQty: number;
  }
>;

export type TechnicianStockReconciledEvent = DomainEvent<
  typeof DomainEventName.TechnicianStockReconciled,
  {
    allocationId: string;
    technicianId: TechnicianId;
    finalStatus: TechnicianStockStatus;
    shortfallQty: number;
  }
>;

// ----------------------------------------------------------------------------
// SUPPORT / TICKETING / CONVERSATION / CALL EVENTS
// ----------------------------------------------------------------------------

export type TicketCreatedEvent = DomainEvent<
  typeof DomainEventName.TicketCreated,
  {
    ticketId: string;
    number: string;
    customerId: CustomerId | null;
    source: TicketSource;
    priority: TicketPriority;
    assignedAgentId: UserId | null;
  }
>;

export type TicketAssignedEvent = DomainEvent<
  typeof DomainEventName.TicketAssigned,
  {
    ticketId: string;
    assignedAgentId: UserId;
    previousAgentId: UserId | null;
  }
>;

export type TicketStatusChangedEvent = DomainEvent<
  typeof DomainEventName.TicketStatusChanged,
  { ticketId: string; from: TicketStatus; to: TicketStatus }
>;

export type TicketPriorityChangedEvent = DomainEvent<
  typeof DomainEventName.TicketPriorityChanged,
  { ticketId: string; from: TicketPriority; to: TicketPriority }
>;

export type TicketEscalatedEvent = DomainEvent<
  typeof DomainEventName.TicketEscalated,
  { ticketId: string; level: number; reason: string | null }
>;

export type TicketResolvedEvent = DomainEvent<
  typeof DomainEventName.TicketResolved,
  { ticketId: string; resolvedBy: UserId | null }
>;

export type TicketReopenedEvent = DomainEvent<
  typeof DomainEventName.TicketReopened,
  { ticketId: string; reopenedBy: UserId | null; reason: string | null }
>;

export type TicketClosedEvent = DomainEvent<
  typeof DomainEventName.TicketClosed,
  { ticketId: string; closedBy: UserId | null }
>;

export type TicketMergedEvent = DomainEvent<
  typeof DomainEventName.TicketMerged,
  { sourceTicketId: string; targetTicketId: string }
>;

export type TicketNoteAddedEvent = DomainEvent<
  typeof DomainEventName.TicketNoteAdded,
  { ticketId: string; messageId: string; authorKind: TicketAuthorKind }
>;

export type TicketReplySentEvent = DomainEvent<
  typeof DomainEventName.TicketReplySent,
  {
    ticketId: string;
    messageId: string;
    conversationMessageId: string | null;
    channel: ConversationChannel | null;
  }
>;

export type TicketFirstResponseRecordedEvent = DomainEvent<
  typeof DomainEventName.TicketFirstResponseRecorded,
  { ticketId: string; respondedAt: string; deltaSeconds: number; metTarget: boolean }
>;

export type TicketSlaBreachWarningEvent = DomainEvent<
  typeof DomainEventName.TicketSlaBreachWarning,
  {
    ticketId: string;
    target: SlaTargetKind;
    dueAt: string;
    minutesRemaining: number;
  }
>;

export type TicketSlaBreachedEvent = DomainEvent<
  typeof DomainEventName.TicketSlaBreached,
  {
    ticketId: string;
    target: SlaTargetKind;
    dueAt: string;
    minutesOverdue: number;
  }
>;

export type TicketCsatRecordedEvent = DomainEvent<
  typeof DomainEventName.TicketCsatRecorded,
  { ticketId: string; rating: number; comment: string | null }
>;

export type ConversationCreatedEvent = DomainEvent<
  typeof DomainEventName.ConversationCreated,
  {
    conversationId: string;
    ticketId: string | null;
    channel: ConversationChannel;
    customerId: CustomerId | null;
  }
>;

export type ConversationAssignedEvent = DomainEvent<
  typeof DomainEventName.ConversationAssigned,
  { conversationId: string; assignedAgentId: UserId }
>;

export type ConversationStatusChangedEvent = DomainEvent<
  typeof DomainEventName.ConversationStatusChanged,
  { conversationId: string; from: ConversationStatus; to: ConversationStatus }
>;

export type ConversationMessageReceivedEvent = DomainEvent<
  typeof DomainEventName.ConversationMessageReceived,
  {
    conversationId: string;
    messageId: string;
    ticketId: string | null;
    channel: ConversationChannel;
    direction: MessageDirection;
    preview: string;
  }
>;

export type ConversationMessageSentEvent = DomainEvent<
  typeof DomainEventName.ConversationMessageSent,
  {
    conversationId: string;
    messageId: string;
    ticketId: string | null;
    channel: ConversationChannel;
    authorUserId: UserId | null;
  }
>;

export type ConversationMessageStatusUpdatedEvent = DomainEvent<
  typeof DomainEventName.ConversationMessageStatusUpdated,
  { conversationId: string; messageId: string; status: MessageStatus }
>;

export type ConversationTypingEvent = DomainEvent<
  typeof DomainEventName.ConversationTyping,
  { conversationId: string; userId: UserId | null; isTyping: boolean }
>;

export type ConversationReadReceiptEvent = DomainEvent<
  typeof DomainEventName.ConversationReadReceipt,
  { conversationId: string; readerKind: TicketAuthorKind; readerUserId: UserId | null; lastReadAt: string }
>;

export type CallIncomingEvent = DomainEvent<
  typeof DomainEventName.CallIncoming,
  {
    callLogId: string;
    direction: CallDirection;
    fromNumber: string;
    toNumber: string;
    customerId: CustomerId | null;
    provider: string;
    queue: string | null;
  }
>;

export type CallAnsweredEvent = DomainEvent<
  typeof DomainEventName.CallAnswered,
  { callLogId: string; agentUserId: UserId; answeredAt: string }
>;

export type CallCompletedEvent = DomainEvent<
  typeof DomainEventName.CallCompleted,
  {
    callLogId: string;
    status: CallStatus;
    durationS: number | null;
    agentUserId: UserId | null;
  }
>;

export type CallMissedEvent = DomainEvent<
  typeof DomainEventName.CallMissed,
  {
    callLogId: string;
    fromNumber: string;
    customerId: CustomerId | null;
    queue: string | null;
  }
>;

export type CallDispositionSetEvent = DomainEvent<
  typeof DomainEventName.CallDispositionSet,
  { callLogId: string; disposition: CallDisposition; notes: string | null }
>;

export type CallRecordingReadyEvent = DomainEvent<
  typeof DomainEventName.CallRecordingReady,
  { callLogId: string; recordingId: string; url: string; durationS: number | null }
>;

export type AnyDomainEvent =
  | LeadCreatedEvent
  | LeadAssignedEvent
  | LeadStatusChangedEvent
  | LeadConvertedEvent
  | LeadNoteAddedEvent
  | BookingCreatedEvent
  | BookingAssignedEvent
  | BookingStatusChangedEvent
  | BookingRescheduledEvent
  | BookingCancelledEvent
  | BookingCompletedEvent
  | BookingOtpSentEvent
  | BookingOtpVerifiedEvent
  | TechnicianLocationUpdatedEvent
  | TechnicianStatusChangedEvent
  | TechnicianOnlineEvent
  | TechnicianOfflineEvent
  | TechnicianArrivedEvent
  | TechnicianDelayedEvent
  | TechnicianUnreachableEvent
  | TechnicianJobAcceptedEvent
  | TechnicianJobRejectedEvent
  | DispatchAutoAssignedEvent
  | DispatchManualAssignedEvent
  | DispatchReassignedEvent
  | DispatchNoCandidatesEvent
  | DispatchAlertRaisedEvent
  | DispatchAlertAcknowledgedEvent
  | InvoiceCreatedEvent
  | InvoiceSentEvent
  | InvoicePaidEvent
  | InvoicePartiallyPaidEvent
  | InvoiceCancelledEvent
  | InvoiceOverdueEvent
  | InvoiceRefundedEvent
  | QuotationCreatedEvent
  | QuotationSentEvent
  | QuotationViewedEvent
  | QuotationApprovedEvent
  | QuotationRejectedEvent
  | QuotationConvertedEvent
  | QuotationExpiredEvent
  | PaymentLinkCreatedEvent
  | PaymentSucceededEvent
  | PaymentFailedEvent
  | PaymentRefundedEvent
  | AmcSubscriptionCreatedEvent
  | AmcSubscriptionActivatedEvent
  | AmcSubscriptionRenewedEvent
  | AmcSubscriptionCancelledEvent
  | AmcSubscriptionExpiringSoonEvent
  | AmcVisitScheduledEvent
  | AmcVisitMissedEvent
  | AmcVisitCompletedEvent
  | PayoutCreatedEvent
  | PayoutApprovedEvent
  | PayoutPaidEvent
  | PayoutFailedEvent
  | CreditNoteIssuedEvent
  | InventoryStockUpdatedEvent
  | InventoryItemCreatedEvent
  | InventoryAlertRaisedEvent
  | InventoryAlertResolvedEvent
  | StockTransferRequestedEvent
  | StockTransferApprovedEvent
  | StockTransferDispatchedEvent
  | StockTransferReceivedEvent
  | StockTransferCancelledEvent
  | PurchaseOrderCreatedEvent
  | PurchaseOrderApprovedEvent
  | PurchaseOrderOrderedEvent
  | PurchaseOrderReceivedEvent
  | PurchaseOrderCancelledEvent
  | GoodsReceiptPostedEvent
  | TechnicianStockAllocatedEvent
  | TechnicianStockAcknowledgedEvent
  | TechnicianStockUsedEvent
  | TechnicianStockReturnedEvent
  | TechnicianStockReconciledEvent
  | TicketCreatedEvent
  | TicketAssignedEvent
  | TicketStatusChangedEvent
  | TicketPriorityChangedEvent
  | TicketEscalatedEvent
  | TicketResolvedEvent
  | TicketReopenedEvent
  | TicketClosedEvent
  | TicketMergedEvent
  | TicketNoteAddedEvent
  | TicketReplySentEvent
  | TicketFirstResponseRecordedEvent
  | TicketSlaBreachWarningEvent
  | TicketSlaBreachedEvent
  | TicketCsatRecordedEvent
  | ConversationCreatedEvent
  | ConversationAssignedEvent
  | ConversationStatusChangedEvent
  | ConversationMessageReceivedEvent
  | ConversationMessageSentEvent
  | ConversationMessageStatusUpdatedEvent
  | ConversationTypingEvent
  | ConversationReadReceiptEvent
  | CallIncomingEvent
  | CallAnsweredEvent
  | CallCompletedEvent
  | CallMissedEvent
  | CallDispositionSetEvent
  | CallRecordingReadyEvent;
