-- Credit-card purchases stop being effective expenses on the purchase date:
-- each parcel is a pending row until it is reconciled against the statement or
-- manually marked as paid. Existing rows are considered effective because
-- "isEffective" defaults to true (no explicit backfill UPDATE needed).
--
-- PostgreSQL 15 allows ALTER TYPE ... ADD VALUE inside the migration
-- transaction because the new value is not used in the same transaction.
ALTER TYPE "FinancialOrigin" ADD VALUE 'CARTAO_CREDITO';

ALTER TABLE "Order" ADD COLUMN "installments" INTEGER;
ALTER TABLE "Order" ADD COLUMN "firstInstallmentAt" DATE;

CREATE TABLE "CreditCardBill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "installments" INTEGER NOT NULL,
    "firstInstallmentAt" DATE NOT NULL,
    "brand" VARCHAR(40),
    "notes" VARCHAR(2000),
    "categoryId" TEXT,
    "orderId" TEXT,
    "paymentType" "PaymentType" NOT NULL DEFAULT 'CARTAO_CREDITO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditCardBill_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FinancialTransaction" ADD COLUMN "isEffective" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "FinancialTransaction" ADD COLUMN "effectiveDate" DATE;
ALTER TABLE "FinancialTransaction" ADD COLUMN "installmentNumber" INTEGER;
ALTER TABLE "FinancialTransaction" ADD COLUMN "installmentsTotal" INTEGER;
ALTER TABLE "FinancialTransaction" ADD COLUMN "paymentType" "PaymentType";
ALTER TABLE "FinancialTransaction" ADD COLUMN "statementFitid" VARCHAR(64);
ALTER TABLE "FinancialTransaction" ADD COLUMN "creditCardBillId" TEXT;

CREATE UNIQUE INDEX "CreditCardBill_orderId_key" ON "CreditCardBill"("orderId");

CREATE INDEX "CreditCardBill_userId_idx" ON "CreditCardBill"("userId");

CREATE INDEX "CreditCardBill_userId_firstInstallmentAt_idx" ON "CreditCardBill"("userId", "firstInstallmentAt");

CREATE INDEX "FinancialTransaction_userId_isEffective_idx" ON "FinancialTransaction"("userId", "isEffective");

ALTER TABLE "CreditCardBill" ADD CONSTRAINT "CreditCardBill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CreditCardBill" ADD CONSTRAINT "CreditCardBill_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CreditCardBill" ADD CONSTRAINT "CreditCardBill_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_creditCardBillId_fkey" FOREIGN KEY ("creditCardBillId") REFERENCES "CreditCardBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
