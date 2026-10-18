-- DropIndex
DROP INDEX "amc_subscriptions_number_key";

-- DropIndex
DROP INDEX "call_logs_number_key";

-- DropIndex
DROP INDEX "credit_notes_number_key";

-- DropIndex
DROP INDEX "goods_receipts_number_key";

-- DropIndex
DROP INDEX "invoices_number_key";

-- DropIndex
DROP INDEX "purchase_orders_number_key";

-- DropIndex
DROP INDEX "quotations_number_key";

-- DropIndex
DROP INDEX "stock_transfers_number_key";

-- DropIndex
DROP INDEX "support_tickets_number_key";

-- DropIndex
DROP INDEX "warranty_claims_number_key";

-- DropIndex
DROP INDEX "workshop_jobs_number_key";

-- AlterTable
ALTER TABLE "quotations" ADD COLUMN     "placeOfSupply" TEXT;

-- CreateTable
CREATE TABLE "document_sequences" (
    "tenantId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("tenantId","prefix","year")
);

-- CreateIndex
CREATE UNIQUE INDEX "amc_subscriptions_tenantId_number_key" ON "amc_subscriptions"("tenantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "call_logs_tenantId_number_key" ON "call_logs"("tenantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_tenantId_number_key" ON "credit_notes"("tenantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_tenantId_number_key" ON "goods_receipts"("tenantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_tenantId_number_key" ON "invoices"("tenantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_tenantId_number_key" ON "purchase_orders"("tenantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_tenantId_number_key" ON "quotations"("tenantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfers_tenantId_number_key" ON "stock_transfers"("tenantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_tenantId_number_key" ON "support_tickets"("tenantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "warranty_claims_tenantId_number_key" ON "warranty_claims"("tenantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "workshop_jobs_tenantId_number_key" ON "workshop_jobs"("tenantId", "number");

