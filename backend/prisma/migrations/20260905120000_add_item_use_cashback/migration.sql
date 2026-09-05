-- Adds Item.useCashback to record whether the item was paid with cashback
-- points (70% discount). Defaults to false; existing rows keep false.
ALTER TABLE "Item"
ADD COLUMN "useCashback" BOOLEAN NOT NULL DEFAULT false;