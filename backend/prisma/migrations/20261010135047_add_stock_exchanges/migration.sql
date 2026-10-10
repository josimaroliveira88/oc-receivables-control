-- CreateEnum
CREATE TYPE "StockExchangeDirection" AS ENUM ('OUT', 'IN');

-- CreateTable
CREATE TABLE "StockExchange" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observation" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockExchange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockExchangeLine" (
    "id" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitValueCents" INTEGER,
    "direction" "StockExchangeDirection" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockExchangeLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockExchange_userId_idx" ON "StockExchange"("userId");

-- CreateIndex
CREATE INDEX "StockExchange_userId_effectiveDate_idx" ON "StockExchange"("userId", "effectiveDate");

-- CreateIndex
CREATE INDEX "StockExchangeLine_exchangeId_idx" ON "StockExchangeLine"("exchangeId");

-- CreateIndex
CREATE INDEX "StockExchangeLine_productId_idx" ON "StockExchangeLine"("productId");

-- AddForeignKey
ALTER TABLE "StockExchange" ADD CONSTRAINT "StockExchange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockExchange" ADD CONSTRAINT "StockExchange_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockExchangeLine" ADD CONSTRAINT "StockExchangeLine_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "StockExchange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockExchangeLine" ADD CONSTRAINT "StockExchangeLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;