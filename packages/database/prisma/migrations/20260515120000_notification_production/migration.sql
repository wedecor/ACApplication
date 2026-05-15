-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "recipientPhone" TEXT,
ADD COLUMN     "recipientEmail" TEXT,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxRetries" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "nextRetryAt" TIMESTAMP(3),
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "providerResponse" JSONB;

-- CreateTable
CREATE TABLE "push_devices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'expo',
    "platform" TEXT,
    "deviceId" TEXT,
    "modelName" TEXT,
    "osVersion" TEXT,
    "appVersion" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "push_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_tenantId_idempotencyKey_channel_key" ON "notifications"("tenantId", "idempotencyKey", "channel");

-- CreateIndex
CREATE INDEX "notifications_tenantId_status_createdAt_idx" ON "notifications"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "push_devices_token_key" ON "push_devices"("token");

-- CreateIndex
CREATE INDEX "push_devices_userId_isActive_idx" ON "push_devices"("userId", "isActive");

-- CreateIndex
CREATE INDEX "push_devices_tenantId_userId_idx" ON "push_devices"("tenantId", "userId");

-- AddForeignKey
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
