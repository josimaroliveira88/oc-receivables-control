import { toCents } from './money.js';
import { badRequest } from './httpError.js';

// DB-backed columns the user can sort by in the sales list.
const SALES_SORTABLE_FIELDS = [
  'orderNumber',
  'orderDate',
  'totalValue',
  'status',
  'deliveredAt',
  'createdAt',
];

// In-memory sort of projected sale orders. `clientName` and `pendingValue`
// are derived from the loaded rows, so they cannot be expressed at the DB
// layer; everything else falls back to pt-BR collation.
const sortSalesInMemory = (orders, sortBy, sortDir) => {
  const direction = sortDir === 'desc' ? -1 : 1;
  return [...orders].sort((a, b) => {
    if (sortBy === 'pendingValue') {
      const pending = (o) =>
        Math.max(
          0,
          toCents(parseFloat(o.totalValue)) -
            (o.payments || []).reduce(
              (sum, p) => sum + toCents(parseFloat(p.amount)),
              0,
            ),
        );
      return (pending(a) - pending(b)) * direction;
    }
    if (sortBy === 'clientName') {
      const name = (o) => o.items?.[0]?.person?.name ?? '';
      return (
        String(name(a)).localeCompare(String(name(b)), 'pt-BR') * direction
      );
    }
    return (
      String(a[sortBy] ?? '').localeCompare(String(b[sortBy] ?? ''), 'pt-BR') *
      direction
    );
  });
};

// Verifies all products exist and are available (ATIVO or INDISPONIVEL).
// Throws a 400 error when at least one product is missing or inactive.
// `client` is either the Prisma client or a transaction client (`tx`).
const validateSaleProducts = async (client, items) => {
  const productIds = [
    ...new Set(items.map((item) => item.productId).filter(Boolean)),
  ];
  if (productIds.length === 0) return;

  const products = await client.product.findMany({
    where: {
      id: { in: productIds },
      status: { in: ['ATIVO', 'INDISPONIVEL'] },
    },
  });

  if (products.length !== productIds.length) {
    throw badRequest('Um ou mais produtos estão inativos ou não existem');
  }
};

export { SALES_SORTABLE_FIELDS, sortSalesInMemory, validateSaleProducts };
