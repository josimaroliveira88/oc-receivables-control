-- CreateEnum
CREATE TYPE "KitStockMode" AS ENUM ('KIT', 'COMPONENTS');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('SIMPLES', 'KIT');

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "kitSnapshot" JSONB,
ADD COLUMN     "kitStockMode" "KitStockMode";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "productType" "ProductType" NOT NULL DEFAULT 'SIMPLES';

-- CreateTable
CREATE TABLE "KitComposition" (
    "id" TEXT NOT NULL,
    "kitProductId" TEXT NOT NULL,
    "componentProductId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KitComposition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KitComposition_componentProductId_idx" ON "KitComposition"("componentProductId");

-- CreateIndex
CREATE UNIQUE INDEX "KitComposition_kitProductId_componentProductId_key" ON "KitComposition"("kitProductId", "componentProductId");

-- AddForeignKey
ALTER TABLE "KitComposition" ADD CONSTRAINT "KitComposition_kitProductId_fkey" FOREIGN KEY ("kitProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitComposition" ADD CONSTRAINT "KitComposition_componentProductId_fkey" FOREIGN KEY ("componentProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
