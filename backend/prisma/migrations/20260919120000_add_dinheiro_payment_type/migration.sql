-- Adds DINHEIRO to the PaymentType enum so cash receipts can be recorded
-- (used by the Sales screen payment forms). Existing rows are unaffected.
ALTER TYPE "PaymentType" ADD VALUE 'DINHEIRO';
