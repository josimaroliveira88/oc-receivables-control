-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('PIX', 'BOLETO', 'CARTAO_CREDITO');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "accountOwner" VARCHAR(120);
ALTER TABLE "Order" ADD COLUMN "paymentType" "PaymentType";
ALTER TABLE "Order" ADD COLUMN "orderNotes" VARCHAR(500);
