-- Adds per-sale flag for passing the payment-gateway fee to the client, and the
-- net amount the user actually received for each payment.
--
-- Existing rows are unaffected: the flag defaults to false and net_amount stays
-- NULL, which means "no fee" (the net equals the charged amount).
ALTER TABLE "Order" ADD COLUMN "passesGatewayFeeToClient" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Payment" ADD COLUMN "netAmount" DECIMAL(10,2);
