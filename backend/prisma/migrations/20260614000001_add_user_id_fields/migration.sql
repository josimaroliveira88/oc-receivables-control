-- AlterTable
ALTER TABLE "Person" ADD COLUMN "userId" TEXT;

-- AlterTable
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_orderNumber_key";
DROP INDEX IF EXISTS "Order_orderNumber_key";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_userId_key" ON "Order"("orderNumber", "userId");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
