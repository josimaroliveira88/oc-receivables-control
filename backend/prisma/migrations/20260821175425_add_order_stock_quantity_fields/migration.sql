-- CreateEnum
CREATE TYPE "ChargedValueMode" AS ENUM ('UNIT', 'TOTAL');

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "chargedValueMode" "ChargedValueMode" NOT NULL DEFAULT 'UNIT',
ADD COLUMN     "forStock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "itemId" TEXT,
ADD COLUMN     "orderId" TEXT;

-- CreateIndex
CREATE INDEX "StockMovement_orderId_idx" ON "StockMovement"("orderId");

-- CreateIndex
CREATE INDEX "StockMovement_itemId_idx" ON "StockMovement"("itemId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
