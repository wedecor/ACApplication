-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'DISPATCHER', 'TECHNICIAN', 'CALL_CENTER_AGENT', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('PASSWORD', 'OTP', 'GOOGLE', 'APPLE', 'CLERK');

-- CreateEnum
CREATE TYPE "SessionDevice" AS ENUM ('WEB', 'ANDROID', 'IOS', 'ADMIN_WEB', 'TECHNICIAN_APP', 'CUSTOMER_APP', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('DRAFT', 'PENDING', 'CONFIRMED', 'ASSIGNED', 'TECHNICIAN_EN_ROUTE', 'IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "BookingPaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "BookingPriority" AS ENUM ('STANDARD', 'PRIORITY', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('AC_REPAIR', 'AC_INSTALLATION', 'AC_SERVICING', 'REFRIGERATOR', 'WASHING_MACHINE', 'MICROWAVE', 'GEYSER', 'CHIMNEY', 'OTHER');

-- CreateEnum
CREATE TYPE "TechnicianStatus" AS ENUM ('OFFLINE', 'ONLINE', 'AVAILABLE', 'BUSY', 'ON_BREAK', 'EN_ROUTE', 'WORKING', 'UNREACHABLE');

-- CreateEnum
CREATE TYPE "DispatchDecision" AS ENUM ('AUTO_ASSIGNED', 'MANUAL_ASSIGNED', 'REASSIGNED', 'RECOMMENDED', 'REJECTED_BY_TECHNICIAN', 'FALLBACK_DISPATCHER', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DispatchAlertKind" AS ENUM ('TECHNICIAN_DELAYED', 'TECHNICIAN_UNREACHABLE', 'BOOKING_OVERDUE', 'LOW_AVAILABILITY', 'NO_CANDIDATES');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'UPI', 'CARD', 'NET_BANKING', 'WALLET', 'RAZORPAY', 'STRIPE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'APPROVED', 'REJECTED', 'EXPIRED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('CREATED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('INVOICE', 'PAYMENT', 'REFUND', 'CREDIT_NOTE', 'AMC_CHARGE', 'AMC_CREDIT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "LedgerEntryDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "AMCPlanType" AS ENUM ('BASIC', 'STANDARD', 'PREMIUM', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AMCSubscriptionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED', 'PENDING_PAYMENT');

-- CreateEnum
CREATE TYPE "AMCVisitStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'MISSED', 'CANCELLED', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('FLAT', 'PERCENTAGE', 'PER_JOB');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('ACCRUED', 'ADJUSTED', 'PAID', 'REVERSED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayoutCycle" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'ON_DEMAND');

-- CreateEnum
CREATE TYPE "CreditNoteStatus" AS ENUM ('DRAFT', 'ISSUED', 'APPLIED', 'VOID');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'PUSH', 'WHATSAPP', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'LOGIN', 'LOGOUT', 'PERMISSION_CHANGE', 'ROLE_CHANGE', 'EXPORT', 'IMPORT');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WEBSITE', 'WHATSAPP', 'GOOGLE_ADS', 'FACEBOOK', 'INSTAGRAM', 'CALL', 'MANUAL', 'REFERRAL');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'BOOKING_CREATED', 'CANCELLED', 'SPAM');

-- CreateEnum
CREATE TYPE "LeadPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'REASSIGNED', 'NOTE_ADDED', 'FIELD_UPDATED', 'TAGS_UPDATED', 'SCHEDULED', 'RESCHEDULED', 'TECHNICIAN_EN_ROUTE', 'ARRIVED_ON_SITE', 'OTP_SENT', 'OTP_VERIFIED', 'WAITING_PARTS', 'WORK_RESUMED', 'COMPLETED', 'CANCELLED', 'ATTACHMENT_ADDED', 'SIGNATURE_CAPTURED', 'PAYMENT_RECORDED', 'CONVERTED_TO_BOOKING');

-- CreateEnum
CREATE TYPE "BookingAttachmentKind" AS ENUM ('PRE_SERVICE_PHOTO', 'POST_SERVICE_PHOTO', 'INVOICE', 'DOCUMENT', 'PARTS_PHOTO', 'OTHER');

-- CreateEnum
CREATE TYPE "InventoryItemType" AS ENUM ('SPARE_PART', 'APPLIANCE', 'CONSUMABLE', 'TOOL', 'ACCESSORY');

-- CreateEnum
CREATE TYPE "InventoryUnit" AS ENUM ('PIECE', 'SET', 'BOX', 'METER', 'KILOGRAM', 'LITRE', 'PACK');

-- CreateEnum
CREATE TYPE "WarehouseKind" AS ENUM ('CENTRAL', 'BRANCH', 'TRANSIT', 'VENDOR_RETURNS', 'SCRAP');

-- CreateEnum
CREATE TYPE "StockMovementKind" AS ENUM ('IN_PURCHASE', 'IN_RETURN_VENDOR', 'IN_RETURN_TECHNICIAN', 'IN_TRANSFER', 'IN_ADJUSTMENT', 'IN_OPENING', 'OUT_SALE', 'OUT_TRANSFER', 'OUT_ADJUSTMENT', 'OUT_TO_TECHNICIAN', 'OUT_TO_BOOKING', 'OUT_SCRAP', 'RESERVE', 'RELEASE_RESERVE');

-- CreateEnum
CREATE TYPE "StockTransferStatus" AS ENUM ('DRAFT', 'REQUESTED', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "GoodsReceiptStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('ACTIVE', 'BLACKLISTED', 'ON_HOLD', 'PROSPECT');

-- CreateEnum
CREATE TYPE "TechnicianStockStatus" AS ENUM ('ALLOCATED', 'ACKNOWLEDGED', 'USED', 'RETURNED', 'RECONCILED');

-- CreateEnum
CREATE TYPE "InventoryAlertKind" AS ENUM ('LOW_STOCK', 'OUT_OF_STOCK', 'EXPIRING_SOON', 'EXPIRED', 'SLOW_MOVING', 'DEAD_STOCK', 'TECHNICIAN_MISMATCH', 'PENDING_TRANSFER', 'OVERDUE_PO', 'NEGATIVE_STOCK');

-- CreateEnum
CREATE TYPE "InventoryAlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "InventoryAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'SNOOZED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'PENDING', 'WAITING_CUSTOMER', 'ON_HOLD', 'ESCALATED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketSource" AS ENUM ('WHATSAPP', 'EMAIL', 'PHONE', 'WEB_CHAT', 'IN_APP_CHAT', 'SMS', 'WALK_IN', 'SOCIAL', 'MANUAL');

-- CreateEnum
CREATE TYPE "TicketAuthorKind" AS ENUM ('CUSTOMER', 'AGENT', 'SYSTEM', 'BOT');

-- CreateEnum
CREATE TYPE "TicketActivityType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'PRIORITY_CHANGED', 'ASSIGNED', 'REASSIGNED', 'ESCALATED', 'DE_ESCALATED', 'NOTE_ADDED', 'REPLY_SENT', 'ATTACHMENT_ADDED', 'TAGS_UPDATED', 'MERGED', 'SPLIT', 'RESOLVED', 'REOPENED', 'CLOSED', 'SLA_BREACH_WARNING', 'SLA_BREACHED', 'CSAT_RECORDED');

-- CreateEnum
CREATE TYPE "ConversationChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'PHONE', 'WEB_CHAT', 'IN_APP_CHAT', 'SMS', 'SOCIAL');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'PENDING', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('QUEUED', 'RINGING', 'IN_PROGRESS', 'COMPLETED', 'MISSED', 'NO_ANSWER', 'BUSY', 'FAILED', 'ABANDONED', 'VOICEMAIL');

-- CreateEnum
CREATE TYPE "CallDisposition" AS ENUM ('RESOLVED', 'CALLBACK_REQUESTED', 'WRONG_NUMBER', 'SPAM', 'COMPLAINT', 'BOOKING_CREATED', 'FOLLOWUP_NEEDED', 'NOT_INTERESTED', 'TECHNICAL_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "SlaTargetKind" AS ENUM ('FIRST_RESPONSE', 'RESOLUTION', 'NEXT_RESPONSE');

-- CreateEnum
CREATE TYPE "SlaScope" AS ENUM ('PRIORITY', 'CATEGORY', 'CHANNEL');

-- CreateEnum
CREATE TYPE "KbArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "KbVisibility" AS ENUM ('PUBLIC', 'INTERNAL', 'CUSTOMER_AUTHENTICATED');

-- CreateEnum
CREATE TYPE "CannedResponseScope" AS ENUM ('GLOBAL', 'TEAM', 'PRIVATE');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "pincodes" TEXT[],
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "serviceableFrom" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "avatarUrl" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "authProvider" "AuthProvider" NOT NULL DEFAULT 'PASSWORD',
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedBy" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" "UserRole" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "user_role_assignments" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,

    CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "device" "SessionDevice" NOT NULL DEFAULT 'UNKNOWN',
    "deviceId" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "destination" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'LOGIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cityId" TEXT,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "defaultAddressId" TEXT,
    "lifetimeValueMinor" BIGINT NOT NULL DEFAULT 0,
    "totalBookings" INTEGER NOT NULL DEFAULT 0,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" TEXT,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "landmark" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technicians" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "skills" "ServiceCategory"[],
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalJobs" INTEGER NOT NULL DEFAULT 0,
    "acceptanceRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "completionRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "dailyCapacity" INTEGER NOT NULL DEFAULT 8,
    "status" "TechnicianStatus" NOT NULL DEFAULT 'OFFLINE',
    "lastSeenAt" TIMESTAMP(3),
    "onlineSince" TIMESTAMP(3),
    "lastLatitude" DOUBLE PRECISION,
    "lastLongitude" DOUBLE PRECISION,
    "lastHeading" DOUBLE PRECISION,
    "lastSpeedMps" DOUBLE PRECISION,
    "lastAccuracyM" DOUBLE PRECISION,
    "lastBatteryPct" INTEGER,
    "lastLocationAt" TIMESTAMP(3),
    "workingHours" JSONB NOT NULL DEFAULT '{}',
    "documents" JSONB NOT NULL DEFAULT '[]',
    "deviceFingerprint" TEXT,
    "locationSignKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "technicians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "leadId" TEXT,
    "customerId" TEXT NOT NULL,
    "technicianId" TEXT,
    "cityId" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "serviceType" TEXT,
    "applianceBrand" TEXT,
    "applianceType" TEXT,
    "issueDescription" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "BookingPriority" NOT NULL DEFAULT 'STANDARD',
    "paymentStatus" "BookingPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "scheduledTimeSlot" TEXT,
    "assignedAt" TIMESTAMP(3),
    "enRouteAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "waitingPartsAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "rescheduledFromAt" TIMESTAMP(3),
    "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "otpCodeHash" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "otpVerifiedAt" TIMESTAMP(3),
    "otpAttempts" INTEGER NOT NULL DEFAULT 0,
    "customerSignatureUrl" TEXT,
    "estimatedAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "finalAmountMinor" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "addressSnapshot" JSONB NOT NULL DEFAULT '{}',
    "geoLatitude" DOUBLE PRECISION,
    "geoLongitude" DOUBLE PRECISION,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_activities" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "actorUserId" TEXT,
    "message" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_notes" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "booking_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_attachments" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" "BookingAttachmentKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "caption" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "booking_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "bookingId" TEXT,
    "amcSubscriptionId" TEXT,
    "customerId" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issueDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "subtotalMinor" INTEGER NOT NULL DEFAULT 0,
    "discountMinor" INTEGER NOT NULL DEFAULT 0,
    "taxMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL DEFAULT 0,
    "amountPaidMinor" INTEGER NOT NULL DEFAULT 0,
    "amountRefundedMinor" INTEGER NOT NULL DEFAULT 0,
    "dueAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "gstEnabled" BOOLEAN NOT NULL DEFAULT true,
    "gstNumber" TEXT,
    "placeOfSupply" TEXT,
    "notes" TEXT,
    "terms" TEXT,
    "pdfUrl" TEXT,
    "pdfHash" TEXT,
    "generatedBy" TEXT,
    "externalRef" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceMinor" INTEGER NOT NULL DEFAULT 0,
    "discountMinor" INTEGER NOT NULL DEFAULT 0,
    "taxRateBps" INTEGER NOT NULL DEFAULT 0,
    "hsnSacCode" TEXT,
    "subtotalMinor" INTEGER NOT NULL DEFAULT 0,
    "taxMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL DEFAULT 0,
    "cgstMinor" INTEGER NOT NULL DEFAULT 0,
    "sgstMinor" INTEGER NOT NULL DEFAULT 0,
    "igstMinor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "gatewayRef" TEXT,
    "gatewayPayload" JSONB,
    "capturedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "amcSubscriptionId" TEXT,
    "purpose" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "method" "PaymentMethod",
    "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'CREATED',
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "orderRef" TEXT,
    "paymentRef" TEXT,
    "hostedLink" TEXT,
    "signatureRef" TEXT,
    "idempotencyKey" TEXT,
    "rawPayload" JSONB,
    "failureCode" TEXT,
    "failureReason" TEXT,
    "authorizedAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "transactionId" TEXT,
    "customerId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "reason" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "gatewayRef" TEXT,
    "gatewayPayload" JSONB,
    "requestedBy" TEXT,
    "approvedBy" TEXT,
    "creditNoteId" TEXT,
    "failureReason" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "reason" TEXT,
    "notes" TEXT,
    "issuedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "pdfHash" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_ledger_entries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "entryType" "LedgerEntryType" NOT NULL,
    "direction" "LedgerEntryDirection" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "description" TEXT NOT NULL,
    "invoiceId" TEXT,
    "paymentId" TEXT,
    "refundId" TEXT,
    "creditNoteId" TEXT,
    "amcSubscriptionId" TEXT,
    "runningBalanceMinor" INTEGER NOT NULL,
    "externalRef" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "bookingId" TEXT,
    "leadId" TEXT,
    "customerId" TEXT NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "convertedInvoiceId" TEXT,
    "subtotalMinor" INTEGER NOT NULL DEFAULT 0,
    "discountMinor" INTEGER NOT NULL DEFAULT 0,
    "taxMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "gstEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "terms" TEXT,
    "pdfUrl" TEXT,
    "pdfHash" TEXT,
    "viewToken" TEXT NOT NULL,
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_line_items" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceMinor" INTEGER NOT NULL DEFAULT 0,
    "discountMinor" INTEGER NOT NULL DEFAULT 0,
    "taxRateBps" INTEGER NOT NULL DEFAULT 0,
    "hsnSacCode" TEXT,
    "subtotalMinor" INTEGER NOT NULL DEFAULT 0,
    "taxMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amc_plans" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AMCPlanType" NOT NULL DEFAULT 'STANDARD',
    "description" TEXT,
    "durationMonths" INTEGER NOT NULL DEFAULT 12,
    "includedVisits" INTEGER NOT NULL DEFAULT 2,
    "emergencySupport" BOOLEAN NOT NULL DEFAULT false,
    "prioritySupport" BOOLEAN NOT NULL DEFAULT false,
    "discountBps" INTEGER NOT NULL DEFAULT 0,
    "appliancesCovered" "ServiceCategory"[],
    "priceMinor" INTEGER NOT NULL DEFAULT 0,
    "renewalPriceMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "visitCadenceDays" INTEGER NOT NULL DEFAULT 180,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "features" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "amc_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amc_subscriptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "AMCSubscriptionStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "resumedAt" TIMESTAMP(3),
    "priceMinor" INTEGER NOT NULL,
    "renewalPriceMinor" INTEGER NOT NULL,
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "visitsScheduled" INTEGER NOT NULL DEFAULT 0,
    "visitsCompleted" INTEGER NOT NULL DEFAULT 0,
    "appliancesSnapshot" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "amc_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "amc_visits" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "visitNumber" INTEGER NOT NULL,
    "status" "AMCVisitStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "missedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "bookingId" TEXT,
    "isComplimentary" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "amc_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technician_commission_rules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "type" "CommissionType" NOT NULL,
    "valueMinor" INTEGER NOT NULL DEFAULT 0,
    "bonusMinor" INTEGER NOT NULL DEFAULT 0,
    "penaltyPerLateMinuteMinor" INTEGER NOT NULL DEFAULT 0,
    "minPayoutMinor" INTEGER NOT NULL DEFAULT 0,
    "payoutCycle" "PayoutCycle" NOT NULL DEFAULT 'WEEKLY',
    "cycleClosesOn" INTEGER NOT NULL DEFAULT 6,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technician_commission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technician_commissions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "baseMinor" INTEGER NOT NULL DEFAULT 0,
    "bonusMinor" INTEGER NOT NULL DEFAULT 0,
    "penaltyMinor" INTEGER NOT NULL DEFAULT 0,
    "adjustmentMinor" INTEGER NOT NULL DEFAULT 0,
    "netMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "CommissionStatus" NOT NULL DEFAULT 'ACCRUED',
    "payoutId" TEXT,
    "ruleSnapshot" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technician_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technician_payouts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "jobsCount" INTEGER NOT NULL DEFAULT 0,
    "grossMinor" INTEGER NOT NULL DEFAULT 0,
    "bonusMinor" INTEGER NOT NULL DEFAULT 0,
    "penaltyMinor" INTEGER NOT NULL DEFAULT 0,
    "adjustmentMinor" INTEGER NOT NULL DEFAULT 0,
    "netMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "paymentRef" TEXT,
    "bankDetails" JSONB,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "technician_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "template" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "providerRef" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en-IN',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" "AuditAction" NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsappNumber" TEXT,
    "email" TEXT,
    "source" "LeadSource" NOT NULL DEFAULT 'MANUAL',
    "applianceType" "ServiceCategory",
    "applianceBrand" TEXT,
    "issueDescription" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "landmark" TEXT,
    "cityId" TEXT,
    "cityLabel" TEXT,
    "pincode" TEXT,
    "geoLatitude" DOUBLE PRECISION,
    "geoLongitude" DOUBLE PRECISION,
    "priority" "LeadPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assignedUserId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "qualifiedAt" TIMESTAMP(3),
    "contactedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "bookingId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "externalRef" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedBy" TEXT,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_notes" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "lead_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activities" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "actorUserId" TEXT,
    "message" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technician_locations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracyM" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "speedMps" DOUBLE PRECISION,
    "altitudeM" DOUBLE PRECISION,
    "batteryPct" INTEGER,
    "isBackground" BOOLEAN NOT NULL DEFAULT false,
    "wasOffline" BOOLEAN NOT NULL DEFAULT false,
    "signature" TEXT,
    "deviceId" TEXT,
    "source" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technician_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technician_availability" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "onlineMinutes" INTEGER NOT NULL DEFAULT 0,
    "availableMinutes" INTEGER NOT NULL DEFAULT 0,
    "workingMinutes" INTEGER NOT NULL DEFAULT 0,
    "onBreakMinutes" INTEGER NOT NULL DEFAULT 0,
    "acceptedJobs" INTEGER NOT NULL DEFAULT 0,
    "rejectedJobs" INTEGER NOT NULL DEFAULT 0,
    "completedJobs" INTEGER NOT NULL DEFAULT 0,
    "cancelledJobs" INTEGER NOT NULL DEFAULT 0,
    "avgRating" DOUBLE PRECISION,
    "avgResponseTimeMin" DOUBLE PRECISION,
    "avgTravelTimeMin" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technician_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technician_shifts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationMin" INTEGER,
    "startedLatitude" DOUBLE PRECISION,
    "startedLongitude" DOUBLE PRECISION,
    "endedLatitude" DOUBLE PRECISION,
    "endedLongitude" DOUBLE PRECISION,
    "endReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technician_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_assignments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "decision" "DispatchDecision" NOT NULL,
    "score" DOUBLE PRECISION,
    "breakdown" JSONB NOT NULL DEFAULT '{}',
    "distanceKm" DOUBLE PRECISION,
    "etaMin" DOUBLE PRECISION,
    "reason" TEXT,
    "replacesId" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispatch_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cityId" TEXT,
    "kind" "DispatchAlertKind" NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "resourceType" TEXT,
    "resourceId" TEXT,
    "technicianId" TEXT,
    "message" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispatch_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "WarehouseKind" NOT NULL DEFAULT 'BRANCH',
    "cityId" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "pincode" TEXT,
    "state" TEXT,
    "gstin" TEXT,
    "managerUserId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_zones" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "binLabel" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "warehouse_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "qrCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "InventoryItemType" NOT NULL DEFAULT 'SPARE_PART',
    "category" TEXT,
    "brand" TEXT,
    "compatibleApplianceCategories" TEXT[],
    "compatibleBrands" TEXT[],
    "unit" "InventoryUnit" NOT NULL DEFAULT 'PIECE',
    "costPriceMinor" INTEGER NOT NULL DEFAULT 0,
    "sellingPriceMinor" INTEGER NOT NULL DEFAULT 0,
    "gstRateBps" INTEGER NOT NULL DEFAULT 1800,
    "hsnCode" TEXT,
    "serialTracking" BOOLEAN NOT NULL DEFAULT false,
    "batchTracking" BOOLEAN NOT NULL DEFAULT false,
    "shelfLifeDays" INTEGER,
    "warrantyDays" INTEGER,
    "preferredVendorId" TEXT,
    "defaultReorderLevel" INTEGER NOT NULL DEFAULT 0,
    "defaultReorderQty" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_stocks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "zoneId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER,
    "reorderQty" INTEGER,
    "avgCostMinor" INTEGER NOT NULL DEFAULT 0,
    "lastMovementAt" TIMESTAMP(3),
    "earliestExpiryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_ledger" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "kind" "StockMovementKind" NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "runningQuantity" INTEGER NOT NULL,
    "runningReserved" INTEGER NOT NULL,
    "unitCostMinor" INTEGER NOT NULL DEFAULT 0,
    "purchaseOrderId" TEXT,
    "goodsReceiptId" TEXT,
    "transferId" TEXT,
    "bookingId" TEXT,
    "invoiceId" TEXT,
    "technicianId" TEXT,
    "technicianAllocationId" TEXT,
    "adjustmentReason" TEXT,
    "description" TEXT,
    "externalRef" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "inventory_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "legalName" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 0,
    "categoriesSupplied" TEXT[],
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lifetimeSpendMinor" INTEGER NOT NULL DEFAULT 0,
    "onTimeRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "ifsc" TEXT,
    "notes" TEXT,
    "status" "VendorStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "expectedAt" TIMESTAMP(3),
    "orderedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "subtotalMinor" INTEGER NOT NULL DEFAULT 0,
    "taxMinor" INTEGER NOT NULL DEFAULT 0,
    "discountMinor" INTEGER NOT NULL DEFAULT 0,
    "shippingMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "pdfHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,
    "unitCostMinor" INTEGER NOT NULL,
    "gstRateBps" INTEGER NOT NULL DEFAULT 1800,
    "taxMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL DEFAULT 0,
    "vendorSku" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "GoodsReceiptStatus" NOT NULL DEFAULT 'POSTED',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "attachments" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_items" (
    "id" TEXT NOT NULL,
    "goodsReceiptId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCostMinor" INTEGER NOT NULL,
    "batchNumber" TEXT,
    "serialNumbers" TEXT[],
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goods_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "sourceWarehouseId" TEXT NOT NULL,
    "destWarehouseId" TEXT NOT NULL,
    "status" "StockTransferStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "notes" TEXT,
    "requestedBy" TEXT,
    "approvedBy" TEXT,
    "receivedBy" TEXT,
    "cancelledBy" TEXT,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer_items" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "requestedQty" INTEGER NOT NULL,
    "dispatchedQty" INTEGER NOT NULL DEFAULT 0,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,
    "unitCostMinor" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technician_inventory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "sourceWarehouseId" TEXT NOT NULL,
    "bookingId" TEXT,
    "status" "TechnicianStockStatus" NOT NULL DEFAULT 'ALLOCATED',
    "allocatedQty" INTEGER NOT NULL,
    "usedQty" INTEGER NOT NULL DEFAULT 0,
    "returnedQty" INTEGER NOT NULL DEFAULT 0,
    "unitCostMinor" INTEGER NOT NULL DEFAULT 0,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "reconciledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technician_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_alerts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" "InventoryAlertKind" NOT NULL,
    "severity" "InventoryAlertSeverity" NOT NULL DEFAULT 'WARNING',
    "status" "InventoryAlertStatus" NOT NULL DEFAULT 'OPEN',
    "itemId" TEXT,
    "warehouseId" TEXT,
    "vendorId" TEXT,
    "transferId" TEXT,
    "purchaseOrderId" TEXT,
    "technicianId" TEXT,
    "title" TEXT NOT NULL,
    "observedValue" INTEGER,
    "thresholdValue" INTEGER,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_cache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "originLat" DOUBLE PRECISION NOT NULL,
    "originLng" DOUBLE PRECISION NOT NULL,
    "destLat" DOUBLE PRECISION NOT NULL,
    "destLng" DOUBLE PRECISION NOT NULL,
    "distanceM" INTEGER NOT NULL,
    "durationS" INTEGER NOT NULL,
    "trafficDurationS" INTEGER,
    "polyline" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customerId" TEXT,
    "anonymousIdentifier" TEXT,
    "bookingId" TEXT,
    "amcSubscriptionId" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "source" "TicketSource" NOT NULL DEFAULT 'MANUAL',
    "category" TEXT,
    "subcategory" TEXT,
    "tags" TEXT[],
    "assignedAgentId" TEXT,
    "assignedTeam" TEXT,
    "slaProfileId" TEXT,
    "firstResponseDueAt" TIMESTAMP(3),
    "resolutionDueAt" TIMESTAMP(3),
    "firstResponseAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "reopenedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "satisfactionRating" INTEGER,
    "csatComment" TEXT,
    "escalationLevel" INTEGER NOT NULL DEFAULT 0,
    "escalatedAt" TIMESTAMP(3),
    "mergedIntoId" TEXT,
    "firstResponseRecorded" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorKind" "TicketAuthorKind" NOT NULL,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "channel" "ConversationChannel",
    "conversationMessageId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_attachments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "messageId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'file',
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ticket_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_activities" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "type" "TicketActivityType" NOT NULL,
    "actorUserId" TEXT,
    "fromStatus" "TicketStatus",
    "toStatus" "TicketStatus",
    "fromPriority" "TicketPriority",
    "toPriority" "TicketPriority",
    "message" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ticketId" TEXT,
    "channel" "ConversationChannel" NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "customerId" TEXT,
    "anonymousIdentifier" TEXT,
    "externalThreadKey" TEXT,
    "subject" TEXT,
    "assignedAgentId" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "lastInboundAt" TIMESTAMP(3),
    "lastOutboundAt" TIMESTAMP(3),
    "unreadAgentCount" INTEGER NOT NULL DEFAULT 0,
    "unreadCustomerCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "kind" "TicketAuthorKind" NOT NULL,
    "userId" TEXT,
    "displayName" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "lastReadAt" TIMESTAMP(3),

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_messages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "authorKind" "TicketAuthorKind" NOT NULL,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "channel" "ConversationChannel" NOT NULL,
    "externalMessageId" TEXT,
    "templateName" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "failureReason" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "direction" "CallDirection" NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'QUEUED',
    "customerId" TEXT,
    "fromNumber" TEXT NOT NULL,
    "toNumber" TEXT NOT NULL,
    "agentUserId" TEXT,
    "ticketId" TEXT,
    "bookingId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "externalCallId" TEXT,
    "queue" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationS" INTEGER,
    "disposition" "CallDisposition",
    "dispositionNotes" TEXT,
    "followupTicketId" TEXT,
    "recordingUrl" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_recordings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "callLogId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "durationS" INTEGER,
    "sizeBytes" INTEGER,
    "transcript" TEXT,
    "language" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "firstResponseMinutes" INTEGER NOT NULL DEFAULT 30,
    "resolutionMinutes" INTEGER NOT NULL DEFAULT 480,
    "businessHoursOnly" BOOLEAN NOT NULL DEFAULT false,
    "priorityOverrides" JSONB NOT NULL DEFAULT '{}',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "sla_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_categories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "parentId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "kb_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_articles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categoryId" TEXT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "excerpt" TEXT,
    "status" "KbArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "KbVisibility" NOT NULL DEFAULT 'PUBLIC',
    "authorUserId" TEXT,
    "tags" TEXT[],
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "notHelpfulCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "kb_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canned_responses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "channels" "ConversationChannel"[],
    "scope" "CannedResponseScope" NOT NULL DEFAULT 'GLOBAL',
    "ownerUserId" TEXT,
    "team" TEXT,
    "tags" TEXT[],
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "canned_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_slug_idx" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "cities_tenantId_isActive_idx" ON "cities"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "cities_tenantId_name_key" ON "cities"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_tenantId_status_idx" ON "users"("tenantId", "status");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenantId_key_key" ON "roles"("tenantId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "permissions_resource_action_idx" ON "permissions"("resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refreshTokenHash_key" ON "sessions"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "otp_challenges_destination_idx" ON "otp_challenges"("destination");

-- CreateIndex
CREATE INDEX "otp_challenges_expiresAt_idx" ON "otp_challenges"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "customers_userId_key" ON "customers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "customers_defaultAddressId_key" ON "customers"("defaultAddressId");

-- CreateIndex
CREATE INDEX "customers_tenantId_phone_idx" ON "customers"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "addresses_customerId_idx" ON "addresses"("customerId");

-- CreateIndex
CREATE INDEX "addresses_pincode_idx" ON "addresses"("pincode");

-- CreateIndex
CREATE UNIQUE INDEX "technicians_userId_key" ON "technicians"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "technicians_employeeCode_key" ON "technicians"("employeeCode");

-- CreateIndex
CREATE INDEX "technicians_tenantId_cityId_status_idx" ON "technicians"("tenantId", "cityId", "status");

-- CreateIndex
CREATE INDEX "technicians_tenantId_status_lastLocationAt_idx" ON "technicians"("tenantId", "status", "lastLocationAt");

-- CreateIndex
CREATE INDEX "technicians_lastLatitude_lastLongitude_idx" ON "technicians"("lastLatitude", "lastLongitude");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_code_key" ON "bookings"("code");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_leadId_key" ON "bookings"("leadId");

-- CreateIndex
CREATE INDEX "bookings_tenantId_status_scheduledAt_idx" ON "bookings"("tenantId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "bookings_customerId_status_idx" ON "bookings"("customerId", "status");

-- CreateIndex
CREATE INDEX "bookings_technicianId_status_idx" ON "bookings"("technicianId", "status");

-- CreateIndex
CREATE INDEX "bookings_cityId_scheduledAt_idx" ON "bookings"("cityId", "scheduledAt");

-- CreateIndex
CREATE INDEX "bookings_tenantId_paymentStatus_idx" ON "bookings"("tenantId", "paymentStatus");

-- CreateIndex
CREATE INDEX "bookings_tenantId_createdAt_idx" ON "bookings"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "booking_activities_bookingId_createdAt_idx" ON "booking_activities"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "booking_activities_tenantId_type_createdAt_idx" ON "booking_activities"("tenantId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "booking_notes_bookingId_createdAt_idx" ON "booking_notes"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "booking_attachments_bookingId_kind_idx" ON "booking_attachments"("bookingId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_bookingId_key" ON "invoices"("bookingId");

-- CreateIndex
CREATE INDEX "invoices_tenantId_status_idx" ON "invoices"("tenantId", "status");

-- CreateIndex
CREATE INDEX "invoices_tenantId_dueDate_idx" ON "invoices"("tenantId", "dueDate");

-- CreateIndex
CREATE INDEX "invoices_customerId_status_idx" ON "invoices"("customerId", "status");

-- CreateIndex
CREATE INDEX "invoices_amcSubscriptionId_idx" ON "invoices"("amcSubscriptionId");

-- CreateIndex
CREATE INDEX "invoice_line_items_invoiceId_idx" ON "invoice_line_items"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transactionId_key" ON "payments"("transactionId");

-- CreateIndex
CREATE INDEX "payments_tenantId_status_idx" ON "payments"("tenantId", "status");

-- CreateIndex
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");

-- CreateIndex
CREATE INDEX "payments_gatewayRef_idx" ON "payments"("gatewayRef");

-- CreateIndex
CREATE INDEX "payment_transactions_tenantId_status_createdAt_idx" ON "payment_transactions"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "payment_transactions_customerId_idx" ON "payment_transactions"("customerId");

-- CreateIndex
CREATE INDEX "payment_transactions_invoiceId_idx" ON "payment_transactions"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_provider_orderRef_key" ON "payment_transactions"("provider", "orderRef");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_provider_idempotencyKey_key" ON "payment_transactions"("provider", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_creditNoteId_key" ON "refunds"("creditNoteId");

-- CreateIndex
CREATE INDEX "refunds_tenantId_status_idx" ON "refunds"("tenantId", "status");

-- CreateIndex
CREATE INDEX "refunds_invoiceId_idx" ON "refunds"("invoiceId");

-- CreateIndex
CREATE INDEX "refunds_paymentId_idx" ON "refunds"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_number_key" ON "credit_notes"("number");

-- CreateIndex
CREATE INDEX "credit_notes_tenantId_status_idx" ON "credit_notes"("tenantId", "status");

-- CreateIndex
CREATE INDEX "credit_notes_customerId_idx" ON "credit_notes"("customerId");

-- CreateIndex
CREATE INDEX "customer_ledger_entries_customerId_occurredAt_idx" ON "customer_ledger_entries"("customerId", "occurredAt");

-- CreateIndex
CREATE INDEX "customer_ledger_entries_tenantId_occurredAt_idx" ON "customer_ledger_entries"("tenantId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "customer_ledger_entries_customerId_externalRef_key" ON "customer_ledger_entries"("customerId", "externalRef");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_number_key" ON "quotations"("number");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_bookingId_key" ON "quotations"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_convertedInvoiceId_key" ON "quotations"("convertedInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_viewToken_key" ON "quotations"("viewToken");

-- CreateIndex
CREATE INDEX "quotations_tenantId_status_idx" ON "quotations"("tenantId", "status");

-- CreateIndex
CREATE INDEX "quotations_customerId_idx" ON "quotations"("customerId");

-- CreateIndex
CREATE INDEX "quotations_expiresAt_idx" ON "quotations"("expiresAt");

-- CreateIndex
CREATE INDEX "quotation_line_items_quotationId_idx" ON "quotation_line_items"("quotationId");

-- CreateIndex
CREATE INDEX "amc_plans_tenantId_isActive_idx" ON "amc_plans"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "amc_plans_tenantId_slug_key" ON "amc_plans"("tenantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "amc_subscriptions_number_key" ON "amc_subscriptions"("number");

-- CreateIndex
CREATE INDEX "amc_subscriptions_tenantId_status_endsAt_idx" ON "amc_subscriptions"("tenantId", "status", "endsAt");

-- CreateIndex
CREATE INDEX "amc_subscriptions_customerId_status_idx" ON "amc_subscriptions"("customerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "amc_visits_bookingId_key" ON "amc_visits"("bookingId");

-- CreateIndex
CREATE INDEX "amc_visits_tenantId_status_scheduledFor_idx" ON "amc_visits"("tenantId", "status", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "amc_visits_subscriptionId_visitNumber_key" ON "amc_visits"("subscriptionId", "visitNumber");

-- CreateIndex
CREATE UNIQUE INDEX "technician_commission_rules_technicianId_key" ON "technician_commission_rules"("technicianId");

-- CreateIndex
CREATE UNIQUE INDEX "technician_commissions_bookingId_key" ON "technician_commissions"("bookingId");

-- CreateIndex
CREATE INDEX "technician_commissions_tenantId_status_idx" ON "technician_commissions"("tenantId", "status");

-- CreateIndex
CREATE INDEX "technician_commissions_technicianId_status_idx" ON "technician_commissions"("technicianId", "status");

-- CreateIndex
CREATE INDEX "technician_commissions_payoutId_idx" ON "technician_commissions"("payoutId");

-- CreateIndex
CREATE UNIQUE INDEX "technician_payouts_code_key" ON "technician_payouts"("code");

-- CreateIndex
CREATE INDEX "technician_payouts_tenantId_status_periodEnd_idx" ON "technician_payouts"("tenantId", "status", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "technician_payouts_technicianId_periodStart_periodEnd_key" ON "technician_payouts"("technicianId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "notifications_userId_status_idx" ON "notifications"("userId", "status");

-- CreateIndex
CREATE INDEX "notifications_tenantId_channel_status_idx" ON "notifications"("tenantId", "channel", "status");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_key_key" ON "notification_templates"("key");

-- CreateIndex
CREATE INDEX "notification_templates_channel_locale_idx" ON "notification_templates"("channel", "locale");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_resourceType_createdAt_idx" ON "audit_logs"("tenantId", "resourceType", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_createdAt_idx" ON "audit_logs"("actorUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "leads_code_key" ON "leads"("code");

-- CreateIndex
CREATE UNIQUE INDEX "leads_bookingId_key" ON "leads"("bookingId");

-- CreateIndex
CREATE INDEX "leads_tenantId_status_createdAt_idx" ON "leads"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "leads_tenantId_cityId_status_idx" ON "leads"("tenantId", "cityId", "status");

-- CreateIndex
CREATE INDEX "leads_assignedUserId_status_idx" ON "leads"("assignedUserId", "status");

-- CreateIndex
CREATE INDEX "leads_phone_idx" ON "leads"("phone");

-- CreateIndex
CREATE INDEX "leads_tenantId_priority_createdAt_idx" ON "leads"("tenantId", "priority", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "leads_tenantId_externalRef_key" ON "leads"("tenantId", "externalRef");

-- CreateIndex
CREATE INDEX "lead_notes_leadId_createdAt_idx" ON "lead_notes"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "lead_activities_leadId_createdAt_idx" ON "lead_activities"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "lead_activities_tenantId_type_createdAt_idx" ON "lead_activities"("tenantId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "technician_locations_technicianId_recordedAt_idx" ON "technician_locations"("technicianId", "recordedAt");

-- CreateIndex
CREATE INDEX "technician_locations_tenantId_recordedAt_idx" ON "technician_locations"("tenantId", "recordedAt");

-- CreateIndex
CREATE INDEX "technician_locations_latitude_longitude_idx" ON "technician_locations"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "technician_availability_tenantId_date_idx" ON "technician_availability"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "technician_availability_technicianId_date_key" ON "technician_availability"("technicianId", "date");

-- CreateIndex
CREATE INDEX "technician_shifts_technicianId_startedAt_idx" ON "technician_shifts"("technicianId", "startedAt");

-- CreateIndex
CREATE INDEX "technician_shifts_tenantId_startedAt_idx" ON "technician_shifts"("tenantId", "startedAt");

-- CreateIndex
CREATE INDEX "dispatch_assignments_bookingId_createdAt_idx" ON "dispatch_assignments"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "dispatch_assignments_tenantId_decision_createdAt_idx" ON "dispatch_assignments"("tenantId", "decision", "createdAt");

-- CreateIndex
CREATE INDEX "dispatch_assignments_technicianId_createdAt_idx" ON "dispatch_assignments"("technicianId", "createdAt");

-- CreateIndex
CREATE INDEX "dispatch_events_tenantId_acknowledgedAt_createdAt_idx" ON "dispatch_events"("tenantId", "acknowledgedAt", "createdAt");

-- CreateIndex
CREATE INDEX "dispatch_events_cityId_kind_createdAt_idx" ON "dispatch_events"("cityId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "warehouses_tenantId_isActive_idx" ON "warehouses"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "warehouses_tenantId_cityId_idx" ON "warehouses"("tenantId", "cityId");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_tenantId_code_key" ON "warehouses"("tenantId", "code");

-- CreateIndex
CREATE INDEX "warehouse_zones_tenantId_warehouseId_idx" ON "warehouse_zones"("tenantId", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_zones_warehouseId_code_key" ON "warehouse_zones"("warehouseId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_qrCode_key" ON "inventory_items"("qrCode");

-- CreateIndex
CREATE INDEX "inventory_items_tenantId_isActive_idx" ON "inventory_items"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "inventory_items_tenantId_type_category_idx" ON "inventory_items"("tenantId", "type", "category");

-- CreateIndex
CREATE INDEX "inventory_items_tenantId_brand_idx" ON "inventory_items"("tenantId", "brand");

-- CreateIndex
CREATE INDEX "inventory_items_barcode_idx" ON "inventory_items"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_tenantId_sku_key" ON "inventory_items"("tenantId", "sku");

-- CreateIndex
CREATE INDEX "warehouse_stocks_tenantId_warehouseId_idx" ON "warehouse_stocks"("tenantId", "warehouseId");

-- CreateIndex
CREATE INDEX "warehouse_stocks_tenantId_itemId_idx" ON "warehouse_stocks"("tenantId", "itemId");

-- CreateIndex
CREATE INDEX "warehouse_stocks_tenantId_quantity_idx" ON "warehouse_stocks"("tenantId", "quantity");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_stocks_warehouseId_itemId_key" ON "warehouse_stocks"("warehouseId", "itemId");

-- CreateIndex
CREATE INDEX "inventory_ledger_itemId_occurredAt_idx" ON "inventory_ledger"("itemId", "occurredAt");

-- CreateIndex
CREATE INDEX "inventory_ledger_warehouseId_occurredAt_idx" ON "inventory_ledger"("warehouseId", "occurredAt");

-- CreateIndex
CREATE INDEX "inventory_ledger_tenantId_occurredAt_idx" ON "inventory_ledger"("tenantId", "occurredAt");

-- CreateIndex
CREATE INDEX "inventory_ledger_bookingId_idx" ON "inventory_ledger"("bookingId");

-- CreateIndex
CREATE INDEX "inventory_ledger_transferId_idx" ON "inventory_ledger"("transferId");

-- CreateIndex
CREATE INDEX "inventory_ledger_purchaseOrderId_idx" ON "inventory_ledger"("purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_ledger_tenantId_externalRef_key" ON "inventory_ledger"("tenantId", "externalRef");

-- CreateIndex
CREATE INDEX "vendors_tenantId_status_idx" ON "vendors"("tenantId", "status");

-- CreateIndex
CREATE INDEX "vendors_tenantId_companyName_idx" ON "vendors"("tenantId", "companyName");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_tenantId_code_key" ON "vendors"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_tenantId_gstin_key" ON "vendors"("tenantId", "gstin");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_number_key" ON "purchase_orders"("number");

-- CreateIndex
CREATE INDEX "purchase_orders_tenantId_status_idx" ON "purchase_orders"("tenantId", "status");

-- CreateIndex
CREATE INDEX "purchase_orders_tenantId_vendorId_idx" ON "purchase_orders"("tenantId", "vendorId");

-- CreateIndex
CREATE INDEX "purchase_orders_tenantId_warehouseId_idx" ON "purchase_orders"("tenantId", "warehouseId");

-- CreateIndex
CREATE INDEX "purchase_order_items_purchaseOrderId_idx" ON "purchase_order_items"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "purchase_order_items_itemId_idx" ON "purchase_order_items"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_number_key" ON "goods_receipts"("number");

-- CreateIndex
CREATE INDEX "goods_receipts_tenantId_receivedAt_idx" ON "goods_receipts"("tenantId", "receivedAt");

-- CreateIndex
CREATE INDEX "goods_receipts_purchaseOrderId_idx" ON "goods_receipts"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "goods_receipt_items_goodsReceiptId_idx" ON "goods_receipt_items"("goodsReceiptId");

-- CreateIndex
CREATE INDEX "goods_receipt_items_itemId_idx" ON "goods_receipt_items"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfers_number_key" ON "stock_transfers"("number");

-- CreateIndex
CREATE INDEX "stock_transfers_tenantId_status_idx" ON "stock_transfers"("tenantId", "status");

-- CreateIndex
CREATE INDEX "stock_transfers_tenantId_sourceWarehouseId_idx" ON "stock_transfers"("tenantId", "sourceWarehouseId");

-- CreateIndex
CREATE INDEX "stock_transfers_tenantId_destWarehouseId_idx" ON "stock_transfers"("tenantId", "destWarehouseId");

-- CreateIndex
CREATE INDEX "stock_transfer_items_transferId_idx" ON "stock_transfer_items"("transferId");

-- CreateIndex
CREATE INDEX "stock_transfer_items_itemId_idx" ON "stock_transfer_items"("itemId");

-- CreateIndex
CREATE INDEX "technician_inventory_tenantId_technicianId_status_idx" ON "technician_inventory"("tenantId", "technicianId", "status");

-- CreateIndex
CREATE INDEX "technician_inventory_tenantId_bookingId_idx" ON "technician_inventory"("tenantId", "bookingId");

-- CreateIndex
CREATE INDEX "technician_inventory_itemId_idx" ON "technician_inventory"("itemId");

-- CreateIndex
CREATE INDEX "inventory_alerts_tenantId_status_severity_idx" ON "inventory_alerts"("tenantId", "status", "severity");

-- CreateIndex
CREATE INDEX "inventory_alerts_tenantId_kind_status_idx" ON "inventory_alerts"("tenantId", "kind", "status");

-- CreateIndex
CREATE INDEX "inventory_alerts_itemId_idx" ON "inventory_alerts"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_alerts_tenantId_dedupeKey_key" ON "inventory_alerts"("tenantId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "route_cache_cacheKey_key" ON "route_cache"("cacheKey");

-- CreateIndex
CREATE INDEX "route_cache_provider_expiresAt_idx" ON "route_cache"("provider", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_number_key" ON "support_tickets"("number");

-- CreateIndex
CREATE INDEX "support_tickets_tenantId_status_priority_idx" ON "support_tickets"("tenantId", "status", "priority");

-- CreateIndex
CREATE INDEX "support_tickets_tenantId_assignedAgentId_status_idx" ON "support_tickets"("tenantId", "assignedAgentId", "status");

-- CreateIndex
CREATE INDEX "support_tickets_tenantId_customerId_idx" ON "support_tickets"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "support_tickets_tenantId_bookingId_idx" ON "support_tickets"("tenantId", "bookingId");

-- CreateIndex
CREATE INDEX "support_tickets_tenantId_firstResponseDueAt_idx" ON "support_tickets"("tenantId", "firstResponseDueAt");

-- CreateIndex
CREATE INDEX "support_tickets_tenantId_resolutionDueAt_idx" ON "support_tickets"("tenantId", "resolutionDueAt");

-- CreateIndex
CREATE INDEX "support_tickets_tenantId_source_status_idx" ON "support_tickets"("tenantId", "source", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_messages_conversationMessageId_key" ON "ticket_messages"("conversationMessageId");

-- CreateIndex
CREATE INDEX "ticket_messages_ticketId_createdAt_idx" ON "ticket_messages"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "ticket_messages_tenantId_authorUserId_idx" ON "ticket_messages"("tenantId", "authorUserId");

-- CreateIndex
CREATE INDEX "ticket_attachments_ticketId_idx" ON "ticket_attachments"("ticketId");

-- CreateIndex
CREATE INDEX "ticket_activities_ticketId_createdAt_idx" ON "ticket_activities"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "conversations_tenantId_status_channel_idx" ON "conversations"("tenantId", "status", "channel");

-- CreateIndex
CREATE INDEX "conversations_tenantId_assignedAgentId_status_idx" ON "conversations"("tenantId", "assignedAgentId", "status");

-- CreateIndex
CREATE INDEX "conversations_tenantId_customerId_idx" ON "conversations"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "conversations_tenantId_lastMessageAt_idx" ON "conversations"("tenantId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_tenantId_channel_externalThreadKey_key" ON "conversations"("tenantId", "channel", "externalThreadKey");

-- CreateIndex
CREATE INDEX "conversation_participants_conversationId_idx" ON "conversation_participants"("conversationId");

-- CreateIndex
CREATE INDEX "conversation_participants_tenantId_userId_idx" ON "conversation_participants"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_participants_conversationId_kind_userId_key" ON "conversation_participants"("conversationId", "kind", "userId");

-- CreateIndex
CREATE INDEX "conversation_messages_conversationId_createdAt_idx" ON "conversation_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "conversation_messages_tenantId_channel_status_idx" ON "conversation_messages"("tenantId", "channel", "status");

-- CreateIndex
CREATE INDEX "conversation_messages_tenantId_sentAt_idx" ON "conversation_messages"("tenantId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_messages_tenantId_channel_externalMessageId_key" ON "conversation_messages"("tenantId", "channel", "externalMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "call_logs_number_key" ON "call_logs"("number");

-- CreateIndex
CREATE INDEX "call_logs_tenantId_status_direction_idx" ON "call_logs"("tenantId", "status", "direction");

-- CreateIndex
CREATE INDEX "call_logs_tenantId_agentUserId_status_idx" ON "call_logs"("tenantId", "agentUserId", "status");

-- CreateIndex
CREATE INDEX "call_logs_tenantId_customerId_idx" ON "call_logs"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "call_logs_tenantId_startedAt_idx" ON "call_logs"("tenantId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "call_logs_tenantId_provider_externalCallId_key" ON "call_logs"("tenantId", "provider", "externalCallId");

-- CreateIndex
CREATE INDEX "call_recordings_callLogId_idx" ON "call_recordings"("callLogId");

-- CreateIndex
CREATE INDEX "sla_profiles_tenantId_isDefault_idx" ON "sla_profiles"("tenantId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "sla_profiles_tenantId_name_key" ON "sla_profiles"("tenantId", "name");

-- CreateIndex
CREATE INDEX "kb_categories_tenantId_parentId_idx" ON "kb_categories"("tenantId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "kb_categories_tenantId_slug_key" ON "kb_categories"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "kb_articles_tenantId_status_visibility_idx" ON "kb_articles"("tenantId", "status", "visibility");

-- CreateIndex
CREATE INDEX "kb_articles_tenantId_categoryId_status_idx" ON "kb_articles"("tenantId", "categoryId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "kb_articles_tenantId_slug_key" ON "kb_articles"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "canned_responses_tenantId_scope_isActive_idx" ON "canned_responses"("tenantId", "scope", "isActive");

-- CreateIndex
CREATE INDEX "canned_responses_tenantId_ownerUserId_idx" ON "canned_responses"("tenantId", "ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "canned_responses_tenantId_code_key" ON "canned_responses"("tenantId", "code");

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_defaultAddressId_fkey" FOREIGN KEY ("defaultAddressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technicians" ADD CONSTRAINT "technicians_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technicians" ADD CONSTRAINT "technicians_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "technicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_activities" ADD CONSTRAINT "booking_activities_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_activities" ADD CONSTRAINT "booking_activities_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_notes" ADD CONSTRAINT "booking_notes_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_notes" ADD CONSTRAINT "booking_notes_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_attachments" ADD CONSTRAINT "booking_attachments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_amcSubscriptionId_fkey" FOREIGN KEY ("amcSubscriptionId") REFERENCES "amc_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "payment_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_amcSubscriptionId_fkey" FOREIGN KEY ("amcSubscriptionId") REFERENCES "amc_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "payment_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "credit_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_ledger_entries" ADD CONSTRAINT "customer_ledger_entries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_ledger_entries" ADD CONSTRAINT "customer_ledger_entries_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_line_items" ADD CONSTRAINT "quotation_line_items_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amc_subscriptions" ADD CONSTRAINT "amc_subscriptions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amc_subscriptions" ADD CONSTRAINT "amc_subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "amc_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amc_visits" ADD CONSTRAINT "amc_visits_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "amc_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amc_visits" ADD CONSTRAINT "amc_visits_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_commission_rules" ADD CONSTRAINT "technician_commission_rules_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "technicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_commissions" ADD CONSTRAINT "technician_commissions_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "technicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_commissions" ADD CONSTRAINT "technician_commissions_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_commissions" ADD CONSTRAINT "technician_commissions_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "technician_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_payouts" ADD CONSTRAINT "technician_payouts_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "technicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_locations" ADD CONSTRAINT "technician_locations_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "technicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_availability" ADD CONSTRAINT "technician_availability_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "technicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_shifts" ADD CONSTRAINT "technician_shifts_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "technicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_assignments" ADD CONSTRAINT "dispatch_assignments_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "technicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_assignments" ADD CONSTRAINT "dispatch_assignments_replacesId_fkey" FOREIGN KEY ("replacesId") REFERENCES "dispatch_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_events" ADD CONSTRAINT "dispatch_events_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "technicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_zones" ADD CONSTRAINT "warehouse_zones_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_preferredVendorId_fkey" FOREIGN KEY ("preferredVendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_stocks" ADD CONSTRAINT "warehouse_stocks_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_stocks" ADD CONSTRAINT "warehouse_stocks_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_stocks" ADD CONSTRAINT "warehouse_stocks_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "warehouse_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_destWarehouseId_fkey" FOREIGN KEY ("destWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "stock_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_inventory" ADD CONSTRAINT "technician_inventory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_amcSubscriptionId_fkey" FOREIGN KEY ("amcSubscriptionId") REFERENCES "amc_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_slaProfileId_fkey" FOREIGN KEY ("slaProfileId") REFERENCES "sla_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "support_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_conversationMessageId_fkey" FOREIGN KEY ("conversationMessageId") REFERENCES "conversation_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ticket_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_activities" ADD CONSTRAINT "ticket_activities_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_activities" ADD CONSTRAINT "ticket_activities_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_agentUserId_fkey" FOREIGN KEY ("agentUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_recordings" ADD CONSTRAINT "call_recordings_callLogId_fkey" FOREIGN KEY ("callLogId") REFERENCES "call_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_categories" ADD CONSTRAINT "kb_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "kb_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "kb_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canned_responses" ADD CONSTRAINT "canned_responses_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
