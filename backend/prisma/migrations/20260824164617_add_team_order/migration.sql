-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'EQUIPE';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "isTeamOrder" BOOLEAN NOT NULL DEFAULT false;
