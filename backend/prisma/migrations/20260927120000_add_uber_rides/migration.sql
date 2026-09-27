-- Uber ride reconciliation (Fase 119). Rides captured from the rider activity
-- feed are persisted so re-importing the same JSON is idempotent (unique
-- `[userId, source, externalId]`) and so the same ride can be launched into the
-- ledger at most once (unique `FinancialTransaction.rideId`).
--
-- PostgreSQL 15 allows ALTER TYPE ... ADD VALUE inside the migration transaction
-- because the new value is not used in the same transaction.
ALTER TYPE "FinancialOrigin" ADD VALUE 'UBER';

CREATE TYPE "RideSource" AS ENUM ('UBER_ACTIVITY_JSON', 'UBER_SESSION', 'UBER_EMAIL', 'UBER_BUSINESS', 'MANUAL');

CREATE TYPE "RideStatus" AS ENUM ('COMPLETED', 'CANCELLED');

CREATE TABLE "RideRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "RideSource" NOT NULL,
    "externalId" VARCHAR(64) NOT NULL,
    "profileType" VARCHAR(20),
    "riderName" VARCHAR(120),
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "destination" VARCHAR(255),
    "amountCents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "status" "RideStatus" NOT NULL DEFAULT 'COMPLETED',
    "importBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RideRecord_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FinancialTransaction" ADD COLUMN "rideId" TEXT;

CREATE UNIQUE INDEX "RideRecord_userId_source_externalId_key" ON "RideRecord"("userId", "source", "externalId");

CREATE INDEX "RideRecord_userId_requestedAt_idx" ON "RideRecord"("userId", "requestedAt");

CREATE INDEX "RideRecord_userId_status_idx" ON "RideRecord"("userId", "status");

CREATE INDEX "RideRecord_userId_importBatchId_idx" ON "RideRecord"("userId", "importBatchId");

CREATE UNIQUE INDEX "FinancialTransaction_rideId_key" ON "FinancialTransaction"("rideId");

ALTER TABLE "RideRecord" ADD CONSTRAINT "RideRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "RideRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Default "Transporte" expense category for existing users. `ensureDefaultCategories`
-- only seeds when a user has no default category yet, so accounts created before
-- this migration would never receive it. `ON CONFLICT DO NOTHING` relies on the
-- `[userId, type, name]` unique constraint, keeping the backfill idempotent.
INSERT INTO "FinancialCategory" ("id", "userId", "name", "type", "isDefault", "active", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u."id", 'Transporte', 'DESPESA', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u
ON CONFLICT ("userId", "type", "name") DO NOTHING;
