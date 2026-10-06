-- Adds the draft-product status used by the dōTERRA orders import: product
-- codes missing from the catalog are auto-registered as drafts the user
-- completes and activates later. Existing rows are unaffected.
ALTER TYPE "ProductStatus" ADD VALUE IF NOT EXISTS 'PENDENTE_CADASTRO';

-- Marks purchase orders created by the dōTERRA import that still need the
-- user's review. Manual orders default to false.
ALTER TABLE "Order" ADD COLUMN "pendingReview" BOOLEAN NOT NULL DEFAULT false;
