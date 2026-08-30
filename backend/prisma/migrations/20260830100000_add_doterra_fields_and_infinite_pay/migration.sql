-- AlterEnum
ALTER TYPE "PaymentType" ADD VALUE 'INFINITE_PAY';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "doterraPv" DECIMAL(10,2),
ADD COLUMN     "doterraValue" DECIMAL(10,2),
ADD COLUMN     "attachmentFilename" VARCHAR(255);

-- AlterTable
ALTER TABLE "Item" DROP COLUMN "pv";