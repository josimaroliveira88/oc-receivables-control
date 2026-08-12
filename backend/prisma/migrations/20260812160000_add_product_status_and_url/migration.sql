-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ATIVO', 'INDISPONIVEL', 'INATIVO');

-- Add new nullable status column with default, then backfill from the old active flag
ALTER TABLE "Product" ADD COLUMN "status" "ProductStatus" NOT NULL DEFAULT 'ATIVO';

-- Backfill: active=true → ATIVO (default already applied), active=false → INATIVO
UPDATE "Product" SET "status" = 'INATIVO' WHERE "active" = false;

-- Add the dōTERRA product page URL (free-form, optional)
ALTER TABLE "Product" ADD COLUMN "doterraUrl" VARCHAR(2048);

-- Replace the active index with a status index
DROP INDEX "Product_active_idx";
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- Drop the legacy boolean column (data preserved via status backfill)
ALTER TABLE "Product" DROP COLUMN "active";
