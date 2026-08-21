-- Enable the unaccent text function so search queries can match
-- accented and unaccented text (e.g. "Cássia" matches "cassia").
-- unaccent is IMMUTABLE in PostgreSQL >= 10, so it is safe to use in
-- WHERE clauses and generated columns.
CREATE EXTENSION IF NOT EXISTS unaccent;