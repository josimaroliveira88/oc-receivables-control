-- Undo the reverted "order-level client" experiment (never released).
--
-- The `Order.clientPersonId` column was added by a local migration that is no
-- longer part of the schema (the order-level client picker was reverted). Any
-- database that had already applied it keeps the column, so it is dropped
-- here. Every statement is guarded with `IF EXISTS` so this migration also
-- succeeds on a fresh database where the column was never created.
DROP INDEX IF EXISTS "Order_clientPersonId_idx";

ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_clientPersonId_fkey";

ALTER TABLE "Order" DROP COLUMN IF EXISTS "clientPersonId";