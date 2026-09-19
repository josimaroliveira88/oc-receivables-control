// Default finance categories seeded per user, plus the mapping used by the
// automatic ledger sync to pick the category of derived rows.
//
// Categories are purely organisational: a transaction may have no category or a
// custom one. The defaults below are created once per user (idempotently) and
// can be renamed/deactivated later without losing financial history.

const DEFAULT_CATEGORIES = [
  { type: 'RECEITA', name: 'Vendas' },
  { type: 'RECEITA', name: 'Bônus dōTERRA' },
  { type: 'RECEITA', name: 'Reembolso' },
  { type: 'RECEITA', name: 'Outras receitas' },
  { type: 'DESPESA', name: 'Compra de produtos dōTERRA' },
  { type: 'DESPESA', name: 'Frete' },
  { type: 'DESPESA', name: 'Taxas de gateway' },
  { type: 'DESPESA', name: 'Material de escritório' },
  { type: 'DESPESA', name: 'Eventos' },
  { type: 'DESPESA', name: 'Marketing' },
  { type: 'DESPESA', name: 'Outras despesas' },
];

// Automatic origin -> default category name. `MANUAL` has no default because the
// user picks the category when creating the entry.
const ORIGIN_CATEGORY_NAMES = {
  VENDA: 'Vendas',
  RESGATE_INFINITEPAY: 'Vendas',
  PEDIDO_DOTERRA: 'Compra de produtos dōTERRA',
  MANUAL: null,
};

function getDefaultCategoryName(origin) {
  return ORIGIN_CATEGORY_NAMES[origin] ?? null;
}

// Idempotently seeds the default categories for a user. Relies on the
// `[userId, type, name]` unique constraint, so running it more than once (or for
// an already-backfilled user) never creates duplicates. `client` is a Prisma
// client or transaction client, so callers can run it inside a `$transaction`.
async function ensureDefaultCategories(userId, client) {
  await client.financialCategory.createMany({
    data: DEFAULT_CATEGORIES.map((category) => ({
      ...category,
      userId,
      isDefault: true,
    })),
    skipDuplicates: true,
  });
}

export {
  DEFAULT_CATEGORIES,
  ORIGIN_CATEGORY_NAMES,
  getDefaultCategoryName,
  ensureDefaultCategories,
};
