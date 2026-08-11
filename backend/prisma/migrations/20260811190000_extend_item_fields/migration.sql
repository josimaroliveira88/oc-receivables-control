-- AlterTable: rename value -> chargedValue and add item enhancement fields

ALTER TABLE "Item" RENAME COLUMN "value" TO "chargedValue";

ALTER TABLE "Item" ALTER COLUMN "description" DROP NOT NULL;

ALTER TABLE "Item" ADD COLUMN "memberPrice" DECIMAL(10,2);
ALTER TABLE "Item" ADD COLUMN "pv" DECIMAL(10,2);
ALTER TABLE "Item" ADD COLUMN "details" VARCHAR(500);
ALTER TABLE "Item" ADD COLUMN "productId" TEXT;

-- CreateIndex
CREATE INDEX "Item_productId_idx" ON "Item"("productId");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;