-- Sales with "Valores Adicionais" generate a linked expense row. The origin is
-- added as a new enum value; PostgreSQL 15 allows this inside the migration
-- transaction because the value is not used in the same transaction.
ALTER TYPE "FinancialOrigin" ADD VALUE 'VENDA_ADICIONAL';
