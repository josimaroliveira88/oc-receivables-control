-- Sales only: whether "Valores Adicionais" are charged to the client. Defaults
-- to true so every existing sale keeps its previous behavior.
ALTER TABLE "Order" ADD COLUMN "additionalValueChargedToClient" BOOLEAN NOT NULL DEFAULT true;
