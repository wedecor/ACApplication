-- CreateEnum
CREATE TYPE "ServiceMode" AS ENUM ('ON_SITE', 'PICKUP_DROP', 'CARRY_IN');

-- CreateEnum
CREATE TYPE "JobCardStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ChecklistKind" AS ENUM ('PRE_SERVICE', 'POST_SERVICE', 'SAFETY');

-- CreateEnum
CREATE TYPE "WarrantyClaimType" AS ENUM ('REPAIR_REVISIT', 'OEM_CLAIM');

-- CreateEnum
CREATE TYPE "WarrantyClaimStatus" AS ENUM ('OPEN', 'APPROVED', 'REJECTED', 'SUBMITTED_TO_OEM', 'SETTLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "WorkshopJobStatus" AS ENUM ('PICKUP_SCHEDULED', 'PICKED_UP', 'RECEIVED_AT_WORKSHOP', 'DIAGNOSING', 'AWAITING_APPROVAL', 'REPAIRING', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENT', 'FLAT');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'QUALIFIED', 'REWARDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('RESIDENTIAL_SOCIETY', 'OFFICE', 'RETAIL', 'HOSPITALITY', 'BUILDER', 'INSTITUTION', 'OTHER');

-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('NEW', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ServiceCategory" ADD VALUE 'TELEVISION';
ALTER TYPE "ServiceCategory" ADD VALUE 'WATER_PURIFIER';
ALTER TYPE "ServiceCategory" ADD VALUE 'DISHWASHER';
ALTER TYPE "ServiceCategory" ADD VALUE 'AIR_COOLER';
ALTER TYPE "ServiceCategory" ADD VALUE 'INVERTER_UPS';
ALTER TYPE "ServiceCategory" ADD VALUE 'CEILING_FAN';
ALTER TYPE "ServiceCategory" ADD VALUE 'OVEN';
ALTER TYPE "ServiceCategory" ADD VALUE 'VACUUM_CLEANER';
ALTER TYPE "ServiceCategory" ADD VALUE 'ELECTRICAL_WIRING';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "applianceId" TEXT,
ADD COLUMN     "catalogItemId" TEXT,
ADD COLUMN     "couponCode" TEXT,
ADD COLUMN     "customFields" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "discountMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isWarrantyRevisit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentBookingId" TEXT,
ADD COLUMN     "repairWarrantyUntil" TIMESTAMP(3),
ADD COLUMN     "serviceMode" "ServiceMode" NOT NULL DEFAULT 'ON_SITE';

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "customFields" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mergedIntoId" TEXT,
ADD COLUMN     "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "customFields" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "customer_appliances" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "addressId" TEXT,
    "category" "ServiceCategory" NOT NULL,
    "brand" TEXT NOT NULL,
    "modelNumber" TEXT,
    "serialNumber" TEXT,
    "capacity" TEXT,
    "installedLocation" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "installDate" TIMESTAMP(3),
    "manufacturerWarrantyUntil" TIMESTAMP(3),
    "extendedWarrantyUntil" TIMESTAMP(3),
    "warrantyProvider" TEXT,
    "purchaseInvoiceUrl" TEXT,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "lastServicedAt" TIMESTAMP(3),
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedBy" TEXT,

    CONSTRAINT "customer_appliances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_catalog_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "basePriceMinor" INTEGER NOT NULL DEFAULT 0,
    "visitChargeMinor" INTEGER NOT NULL DEFAULT 0,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 60,
    "repairWarrantyDays" INTEGER NOT NULL DEFAULT 30,
    "gstRateBps" INTEGER NOT NULL DEFAULT 1800,
    "sacCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedBy" TEXT,

    CONSTRAINT "service_catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fault_codes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "brand" TEXT,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "suggestedFix" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "fault_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "kind" "ChecklistKind" NOT NULL DEFAULT 'POST_SERVICE',
    "name" TEXT NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_cards" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "technicianId" TEXT,
    "applianceId" TEXT,
    "status" "JobCardStatus" NOT NULL DEFAULT 'DRAFT',
    "symptoms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "faultCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "diagnosis" TEXT,
    "rootCause" TEXT,
    "resolution" TEXT,
    "readings" JSONB NOT NULL DEFAULT '{}',
    "checklist" JSONB NOT NULL DEFAULT '[]',
    "partsRecommended" JSONB NOT NULL DEFAULT '[]',
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "firstTimeFix" BOOLEAN,
    "technicianRemarks" TEXT,
    "customerRemarks" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "job_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranty_claims" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "WarrantyClaimType" NOT NULL,
    "status" "WarrantyClaimStatus" NOT NULL DEFAULT 'OPEN',
    "customerId" TEXT NOT NULL,
    "applianceId" TEXT,
    "originalBookingId" TEXT,
    "revisitBookingId" TEXT,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "oemName" TEXT,
    "oemClaimRef" TEXT,
    "claimAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "settledAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "decisionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedBy" TEXT,

    CONSTRAINT "warranty_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workshop_jobs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "status" "WorkshopJobStatus" NOT NULL DEFAULT 'PICKUP_SCHEDULED',
    "pickupScheduledAt" TIMESTAMP(3),
    "pickedUpAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "estimatedReadyAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "outForDeliveryAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "pickupAgentUserId" TEXT,
    "deliveryAgentUserId" TEXT,
    "benchTechnicianId" TEXT,
    "conditionOnReceipt" TEXT,
    "accessoriesReceived" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "history" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "workshop_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_ratings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "technicianId" TEXT,
    "value" INTEGER NOT NULL,
    "npsScore" INTEGER,
    "comment" TEXT,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reviewRequestedAt" TIMESTAMP(3),
    "publicReviewUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "booking_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_payment_methods" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "gatewayToken" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "last4" TEXT,
    "brand" TEXT,
    "expiresAt" TIMESTAMP(3),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "saved_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "CouponDiscountType" NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "maxDiscountMinor" INTEGER,
    "minOrderMinor" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "perCustomerLimit" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "categories" "ServiceCategory"[] DEFAULT ARRAY[]::"ServiceCategory"[],
    "firstBookingOnly" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedBy" TEXT,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_redemptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "bookingId" TEXT,
    "invoiceId" TEXT,
    "discountMinor" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_codes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "referral_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "referralCodeId" TEXT NOT NULL,
    "referrerCustomerId" TEXT NOT NULL,
    "referredCustomerId" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "rewardMinor" INTEGER NOT NULL DEFAULT 0,
    "qualifiedBookingId" TEXT,
    "qualifiedAt" TIMESTAMP(3),
    "rewardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_ledger_entries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "loyalty_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_segments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB NOT NULL DEFAULT '{}',
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "lastComputedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedBy" TEXT,

    CONSTRAINT "customer_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "segmentId" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "templateKey" TEXT NOT NULL,
    "message" TEXT,
    "couponId" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "stats" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedBy" TEXT,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL DEFAULT 'OTHER',
    "gstin" TEXT,
    "billingEmail" TEXT,
    "phone" TEXT,
    "ownerUserId" TEXT,
    "addressLine" TEXT,
    "cityId" TEXT,
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedBy" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "accountId" TEXT,
    "customerId" TEXT,
    "leadId" TEXT,
    "stage" "OpportunityStage" NOT NULL DEFAULT 'NEW',
    "valueMinor" INTEGER NOT NULL DEFAULT 0,
    "probabilityPct" INTEGER NOT NULL DEFAULT 10,
    "expectedCloseAt" TIMESTAMP(3),
    "ownerUserId" TEXT,
    "lostReason" TEXT,
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedBy" TEXT,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "dueAt" TIMESTAMP(3),
    "reminderAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "assigneeUserId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedBy" TEXT,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_definitions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedBy" TEXT,

    CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_appliances_tenantId_customerId_idx" ON "customer_appliances"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "customer_appliances_tenantId_serialNumber_idx" ON "customer_appliances"("tenantId", "serialNumber");

-- CreateIndex
CREATE INDEX "customer_appliances_tenantId_category_idx" ON "customer_appliances"("tenantId", "category");

-- CreateIndex
CREATE INDEX "service_catalog_items_tenantId_category_isActive_idx" ON "service_catalog_items"("tenantId", "category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "service_catalog_items_tenantId_code_key" ON "service_catalog_items"("tenantId", "code");

-- CreateIndex
CREATE INDEX "fault_codes_tenantId_category_isActive_idx" ON "fault_codes"("tenantId", "category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "fault_codes_tenantId_category_code_key" ON "fault_codes"("tenantId", "category", "code");

-- CreateIndex
CREATE INDEX "checklist_templates_tenantId_category_kind_isActive_idx" ON "checklist_templates"("tenantId", "category", "kind", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "job_cards_bookingId_key" ON "job_cards"("bookingId");

-- CreateIndex
CREATE INDEX "job_cards_tenantId_status_idx" ON "job_cards"("tenantId", "status");

-- CreateIndex
CREATE INDEX "job_cards_tenantId_technicianId_idx" ON "job_cards"("tenantId", "technicianId");

-- CreateIndex
CREATE UNIQUE INDEX "warranty_claims_number_key" ON "warranty_claims"("number");

-- CreateIndex
CREATE UNIQUE INDEX "warranty_claims_revisitBookingId_key" ON "warranty_claims"("revisitBookingId");

-- CreateIndex
CREATE INDEX "warranty_claims_tenantId_status_createdAt_idx" ON "warranty_claims"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "warranty_claims_tenantId_type_status_idx" ON "warranty_claims"("tenantId", "type", "status");

-- CreateIndex
CREATE INDEX "warranty_claims_customerId_idx" ON "warranty_claims"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "workshop_jobs_number_key" ON "workshop_jobs"("number");

-- CreateIndex
CREATE UNIQUE INDEX "workshop_jobs_bookingId_key" ON "workshop_jobs"("bookingId");

-- CreateIndex
CREATE INDEX "workshop_jobs_tenantId_status_updatedAt_idx" ON "workshop_jobs"("tenantId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "booking_ratings_bookingId_key" ON "booking_ratings"("bookingId");

-- CreateIndex
CREATE INDEX "booking_ratings_tenantId_createdAt_idx" ON "booking_ratings"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "booking_ratings_tenantId_technicianId_idx" ON "booking_ratings"("tenantId", "technicianId");

-- CreateIndex
CREATE INDEX "saved_payment_methods_tenantId_customerId_idx" ON "saved_payment_methods"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "coupons_tenantId_isActive_idx" ON "coupons"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_tenantId_code_key" ON "coupons"("tenantId", "code");

-- CreateIndex
CREATE INDEX "coupon_redemptions_couponId_customerId_idx" ON "coupon_redemptions"("couponId", "customerId");

-- CreateIndex
CREATE INDEX "coupon_redemptions_tenantId_createdAt_idx" ON "coupon_redemptions"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "referral_codes_customerId_key" ON "referral_codes"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "referral_codes_tenantId_code_key" ON "referral_codes"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referredCustomerId_key" ON "referrals"("referredCustomerId");

-- CreateIndex
CREATE INDEX "referrals_tenantId_status_idx" ON "referrals"("tenantId", "status");

-- CreateIndex
CREATE INDEX "referrals_referrerCustomerId_idx" ON "referrals"("referrerCustomerId");

-- CreateIndex
CREATE INDEX "loyalty_ledger_entries_customerId_createdAt_idx" ON "loyalty_ledger_entries"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "customer_segments_tenantId_idx" ON "customer_segments"("tenantId");

-- CreateIndex
CREATE INDEX "campaigns_tenantId_status_scheduledAt_idx" ON "campaigns"("tenantId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "accounts_tenantId_type_idx" ON "accounts"("tenantId", "type");

-- CreateIndex
CREATE INDEX "opportunities_tenantId_stage_expectedCloseAt_idx" ON "opportunities"("tenantId", "stage", "expectedCloseAt");

-- CreateIndex
CREATE INDEX "opportunities_tenantId_ownerUserId_idx" ON "opportunities"("tenantId", "ownerUserId");

-- CreateIndex
CREATE INDEX "tasks_tenantId_assigneeUserId_status_dueAt_idx" ON "tasks"("tenantId", "assigneeUserId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "tasks_tenantId_entityType_entityId_idx" ON "tasks"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "tasks_tenantId_status_reminderAt_idx" ON "tasks"("tenantId", "status", "reminderAt");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_definitions_tenantId_entity_key_key" ON "custom_field_definitions"("tenantId", "entity", "key");

-- CreateIndex
CREATE INDEX "bookings_applianceId_idx" ON "bookings"("applianceId");

-- CreateIndex
CREATE INDEX "bookings_parentBookingId_idx" ON "bookings"("parentBookingId");

-- CreateIndex
CREATE INDEX "customers_tenantId_accountId_idx" ON "customers"("tenantId", "accountId");

-- CreateIndex
CREATE INDEX "customers_tenantId_mergedIntoId_idx" ON "customers"("tenantId", "mergedIntoId");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_applianceId_fkey" FOREIGN KEY ("applianceId") REFERENCES "customer_appliances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "service_catalog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_parentBookingId_fkey" FOREIGN KEY ("parentBookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_appliances" ADD CONSTRAINT "customer_appliances_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_appliances" ADD CONSTRAINT "customer_appliances_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_applianceId_fkey" FOREIGN KEY ("applianceId") REFERENCES "customer_appliances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_applianceId_fkey" FOREIGN KEY ("applianceId") REFERENCES "customer_appliances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_originalBookingId_fkey" FOREIGN KEY ("originalBookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_revisitBookingId_fkey" FOREIGN KEY ("revisitBookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshop_jobs" ADD CONSTRAINT "workshop_jobs_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_ratings" ADD CONSTRAINT "booking_ratings_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_ratings" ADD CONSTRAINT "booking_ratings_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_payment_methods" ADD CONSTRAINT "saved_payment_methods_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "referral_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerCustomerId_fkey" FOREIGN KEY ("referrerCustomerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referredCustomerId_fkey" FOREIGN KEY ("referredCustomerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_ledger_entries" ADD CONSTRAINT "loyalty_ledger_entries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "customer_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
