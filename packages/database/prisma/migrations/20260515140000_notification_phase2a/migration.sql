-- AlterEnum (idempotent)
DO $$ BEGIN ALTER TYPE "NotificationStatus" ADD VALUE 'PROCESSING'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "NotificationStatus" ADD VALUE 'RETRYING'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "NotificationStatus" ADD VALUE 'DLQ'; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "correlationId" TEXT;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "processingStartedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "notification_delivery_events" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL,
    "provider" TEXT,
    "detail" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_delivery_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_correlationId_idx" ON "notifications"("correlationId");
CREATE INDEX IF NOT EXISTS "notifications_providerRef_idx" ON "notifications"("providerRef");
CREATE INDEX IF NOT EXISTS "notification_delivery_events_notificationId_createdAt_idx" ON "notification_delivery_events"("notificationId", "createdAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "notification_delivery_events" ADD CONSTRAINT "notification_delivery_events_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
