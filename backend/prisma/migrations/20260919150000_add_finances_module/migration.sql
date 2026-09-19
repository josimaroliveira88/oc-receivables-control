-- CreateEnum
CREATE TYPE "FinancialTransactionType" AS ENUM ('RECEITA', 'DESPESA');

-- CreateEnum
CREATE TYPE "FinancialOrigin" AS ENUM ('VENDA', 'RESGATE_INFINITEPAY', 'PEDIDO_DOTERRA', 'MANUAL');

-- CreateTable
CREATE TABLE "FinancialCategory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinancialTransactionType" NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "FinancialTransactionType" NOT NULL,
    "origin" "FinancialOrigin" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "transactionDate" DATE NOT NULL,
    "notes" VARCHAR(2000),
    "categoryId" TEXT,
    "orderId" TEXT,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinancialCategory_userId_idx" ON "FinancialCategory"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialCategory_userId_type_name_key" ON "FinancialCategory"("userId", "type", "name");

-- CreateIndex
CREATE INDEX "FinancialTransaction_userId_transactionDate_idx" ON "FinancialTransaction"("userId", "transactionDate");

-- CreateIndex
CREATE INDEX "FinancialTransaction_userId_type_idx" ON "FinancialTransaction"("userId", "type");

-- CreateIndex
CREATE INDEX "FinancialTransaction_userId_categoryId_idx" ON "FinancialTransaction"("userId", "categoryId");

-- CreateIndex
CREATE INDEX "FinancialTransaction_orderId_idx" ON "FinancialTransaction"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialTransaction_paymentId_key" ON "FinancialTransaction"("paymentId");

-- AddForeignKey
ALTER TABLE "FinancialCategory" ADD CONSTRAINT "FinancialCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

