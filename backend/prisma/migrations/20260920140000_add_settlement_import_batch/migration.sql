-- Adds the optional import batch that groups the InfinitePay redemptions created
-- by a single statement import, so the whole import can be undone at once.
ALTER TABLE "FinancialTransaction" ADD COLUMN "importBatchId" TEXT;

-- CreateIndex
CREATE INDEX "FinancialTransaction_userId_importBatchId_idx" ON "FinancialTransaction"("userId", "importBatchId");
