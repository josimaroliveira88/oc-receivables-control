-- AlterTable
-- Rename the legacy `contact` column to `whatsapp`, preserving existing data
-- (Prisma's default DROP + ADD would lose all contact values).
ALTER TABLE "Person" RENAME COLUMN "contact" TO "whatsapp";

-- Extend Person with the new client registration fields (all nullable/optional)
ALTER TABLE "Person"
  ADD COLUMN     "commonGroups" VARCHAR(255),
  ADD COLUMN     "instagram" VARCHAR(255),
  ADD COLUMN     "address" VARCHAR(500),
  ADD COLUMN     "isVip" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN     "isDoterraMember" BOOLEAN NOT NULL DEFAULT false;
