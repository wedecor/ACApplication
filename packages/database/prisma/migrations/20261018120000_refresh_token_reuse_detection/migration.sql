-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "previousRefreshTokenHash" TEXT,
ADD COLUMN     "refreshRotatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_previousRefreshTokenHash_key" ON "sessions"("previousRefreshTokenHash");

