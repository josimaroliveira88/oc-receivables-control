const { Prisma } = require('@prisma/client');
const prisma = require('../config/database');

// Escape LIKE wildcards so user input is treated literally.
// `%` and `_` in the search term must not act as wildcards.
const escapeLikePattern = (value) =>
  String(value).replace(/[\\%_]/g, (m) => '\\' + m);

// Return the IDs of rows whose listed text columns match the search term
// using accent- and case-insensitive comparison (PostgreSQL `unaccent`).
// Returns null when the query is empty so callers can skip the lookup.
// The caller still scopes by userId / other filters via Prisma; foreign
// IDs returned here are silently filtered out by the Prisma `findMany`.
const findIdsByTextSearch = async ({ table, idColumn = 'id', columns, q }) => {
  if (!q || !q.trim()) return null;
  const term = `%${escapeLikePattern(q.trim().toLowerCase())}%`;
  // Quote identifiers so PostgreSQL preserves their case (Prisma migrations
  // create tables like "Person" / "Order" / "Product" with quoted identifiers).
  const quote = (name) => `"${String(name).replace(/"/g, '""')}"`;
  const conditions = columns.map(
    (col) =>
      Prisma.sql`unaccent(lower(${Prisma.raw(quote(col))})) LIKE unaccent(lower(${term}))`,
  );
  const orClause = Prisma.join(conditions, ' OR ');
  const rows = await prisma.$queryRaw(Prisma.sql`
    SELECT ${Prisma.raw(quote(idColumn))} AS id
      FROM ${Prisma.raw(quote(table))}
     WHERE (${orClause})
  `);
  return rows.map((r) => r.id);
};
module.exports = { escapeLikePattern, findIdsByTextSearch };
