-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('COMPRA', 'VENDA');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "additionalValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "orderType" "OrderType" NOT NULL DEFAULT 'COMPRA';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "paymentType" "PaymentType";

-- CreateTable
CREATE TABLE "SaleCounter" (
    "userId" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleCounter_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "SaleCounter" ADD CONSTRAINT "SaleCounter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
