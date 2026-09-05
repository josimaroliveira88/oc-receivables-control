const { lineValueCents, toCents } = require('./money');

// DB-backed columns the user can sort by in the orders list.
const ORDER_SORTABLE_FIELDS = [
  'orderNumber',
  'orderDate',
  'totalValue',
  'status',
  'paymentType',
  'accountOwner',
  'orderNotes',
  'doterraPv',
  'doterraValue',
  'createdAt',
];

// Computed value used to sort orders that have no direct DB column:
// - pendingCents: totalValue - (self person items) - (payments)
const orderSortValue = (order, field) => {
  if (field === 'pendingCents') {
    if (order.isTeamOrder) return 0;
    const selfCents = (order.items || [])
      .filter((item) => item.person && item.person.isSelf)
      .reduce((sum, item) => sum + lineValueCents(item), 0);
    const paidCents = (order.payments || []).reduce(
      (sum, p) => sum + toCents(parseFloat(p.amount)),
      0,
    );
    return Math.max(
      0,
      toCents(parseFloat(order.totalValue)) - selfCents - paidCents,
    );
  }
  return undefined;
};

const sortOrdersInMemory = (orders, sortBy, sortDir) => {
  const direction = sortDir === 'desc' ? -1 : 1;
  const numericFields = ['pendingCents', 'totalValue'];
  return [...orders].sort((a, b) => {
    if (numericFields.includes(sortBy)) {
      const aComputed = orderSortValue(a, sortBy);
      const bComputed = orderSortValue(b, sortBy);
      const aValue =
        aComputed !== undefined ? aComputed : Number(a[sortBy]) || 0;
      const bValue =
        bComputed !== undefined ? bComputed : Number(b[sortBy]) || 0;
      return (aValue - bValue) * direction;
    }
    return (
      String(a[sortBy] ?? '').localeCompare(String(b[sortBy] ?? ''), 'pt-BR') *
      direction
    );
  });
};

module.exports = {
  ORDER_SORTABLE_FIELDS,
  orderSortValue,
  sortOrdersInMemory,
};
