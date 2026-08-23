-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "StockMovement_userId_effectiveDate_idx" ON "StockMovement"("userId", "effectiveDate");