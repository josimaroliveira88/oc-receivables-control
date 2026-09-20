// Automatic ledger sync: derives financial transactions from sales payments
// (income) and dōTERRA purchase orders (expense). Every function receives the
// active Prisma transaction client so the derived row is written inside the
// same transaction as its source, keeping the ledger consistent with the
// payment/order it mirrors.
//
// Automatic rows are owned by their source: editing the source re-syncs the row
// and deleting it removes the row (also covered by the FK cascade). Only
// MANUAL rows are editable through the finances endpoints.
import { getDefaultCategoryName } from '../utils/financeDefaults.js';
import { assertCategoryMatches } from '../utils/financeCategory.js';
import { toCents } from '../utils/money.js';
import { badRequest } from '../utils/httpError.js';

// Looks up the user's default category for an automatic origin. Returns `null`
// when no default applies (MANUAL) or when the category no longer exists, so
// the row is still created (uncategorised) instead of failing the source write.
const resolveCategoryId = async (client, userId, origin) => {
  const name = getDefaultCategoryName(origin);
  if (!name) return null;

  const category = await client.financialCategory.findFirst({
    where: { userId, name },
  });

  return category?.id ?? null;
};

const removeIncomeForPayment = (client, paymentId) =>
  client.financialTransaction.deleteMany({ where: { paymentId } });

const removeExpenseForOrder = (client, orderId) =>
  client.financialTransaction.deleteMany({
    where: { orderId, origin: 'PEDIDO_DOTERRA' },
  });

// Only payments on non-team sales feed the ledger. InfinitePay payments are
// excluded because their money only enters on a manual redemption, and dōTERRA
// order payments never produce a transaction.
const shouldSyncIncome = ({ payment, order }) =>
  order.orderType === 'VENDA' &&
  !order.isTeamOrder &&
  payment.paymentType !== 'INFINITE_PAY';

// A purchase order shared by more than one client (items linked to two or more
// distinct people) uses its displayed total as the ledger amount, instead of
// the dōTERRA value, so each shared order reflects the value the user sees in
// the orders list.
const orderHasMultipleClients = async (client, orderId) => {
  const rows = await client.item.findMany({
    where: { orderId, personId: { not: null } },
    distinct: ['personId'],
    select: { personId: true },
  });
  return rows.length > 1;
};

// Creates/updates the income row derived from a sale payment, or removes the
// existing row when the payment must not feed the ledger. Keyed by the unique
// `paymentId`, so it is idempotent.
const syncIncomeFromPayment = async (client, { userId, payment, order }) => {
  if (!shouldSyncIncome({ payment, order })) {
    await removeIncomeForPayment(client, payment.id);
    return null;
  }

  const person = payment.personId
    ? await client.person.findFirst({
        where: { id: payment.personId },
        select: { name: true },
      })
    : null;

  const data = {
    userId,
    type: 'RECEITA',
    origin: 'VENDA',
    amount: payment.amount,
    description: person
      ? `Venda ${order.orderNumber} — ${person.name}`
      : `Venda ${order.orderNumber}`,
    transactionDate: payment.paidAt,
    categoryId: await resolveCategoryId(client, userId, 'VENDA'),
    orderId: order.id,
  };

  return client.financialTransaction.upsert({
    where: { paymentId: payment.id },
    create: { ...data, paymentId: payment.id },
    update: data,
  });
};

// Creates/updates the single expense row derived from a dōTERRA purchase order,
// or removes it when the order is a team order (which never affects the user's
// finances) or is not a purchase at all.
const syncExpenseFromOrder = async (client, { userId, order }) => {
  if (order.orderType !== 'COMPRA' || order.isTeamOrder) {
    await removeExpenseForOrder(client, order.id);
    return null;
  }

  const amount = (await orderHasMultipleClients(client, order.id))
    ? order.totalValue
    : (order.doterraValue ?? order.totalValue);

  const data = {
    userId,
    type: 'DESPESA',
    origin: 'PEDIDO_DOTERRA',
    amount,
    description: `Pedido dōTERRA ${order.orderNumber}`,
    transactionDate: order.orderDate,
    categoryId: await resolveCategoryId(client, userId, 'PEDIDO_DOTERRA'),
    orderId: order.id,
  };

  // No compound unique covers (orderId, origin), so the row is looked up before
  // deciding between update and create. There is at most one per purchase order.
  const existing = await client.financialTransaction.findFirst({
    where: { orderId: order.id, origin: 'PEDIDO_DOTERRA' },
  });

  if (existing) {
    return client.financialTransaction.update({
      where: { id: existing.id },
      data,
    });
  }

  return client.financialTransaction.create({ data });
};

// Creates/updates the single expense row derived from a sale's "Valores
// Adicionais" (extra charges the user also records as a cost), or removes it
// when the sale carries no additional value or is a team order. The category
// and description are user-provided, so they are required whenever the expense
// exists; the category must be the user's and of type DESPESA.
const syncAdditionalExpenseFromSale = async (
  client,
  { userId, order, categoryId, description },
) => {
  if (order.isTeamOrder || toCents(order.additionalValue ?? 0) <= 0) {
    await client.financialTransaction.deleteMany({
      where: { orderId: order.id, origin: 'VENDA_ADICIONAL' },
    });
    return null;
  }

  const existing = await client.financialTransaction.findFirst({
    where: { orderId: order.id, origin: 'VENDA_ADICIONAL' },
  });

  // A scalar update that does not touch the expense (e.g. toggling delivery)
  // keeps the stored category/description; the required-again rule only bites
  // when there is nothing to fall back to.
  const effectiveCategoryId = categoryId ?? existing?.categoryId ?? null;
  const effectiveDescription =
    description != null && String(description).trim()
      ? String(description).trim()
      : (existing?.description ?? '');

  if (!effectiveCategoryId) {
    throw badRequest('A categoria da despesa é obrigatória');
  }
  if (!effectiveDescription) {
    throw badRequest('A descrição da despesa é obrigatória');
  }

  await assertCategoryMatches(client, userId, {
    categoryId: effectiveCategoryId,
    type: 'DESPESA',
  });

  const data = {
    userId,
    type: 'DESPESA',
    origin: 'VENDA_ADICIONAL',
    amount: order.additionalValue,
    description: effectiveDescription,
    transactionDate: order.orderDate,
    categoryId: effectiveCategoryId,
    orderId: order.id,
  };

  if (existing) {
    return client.financialTransaction.update({
      where: { id: existing.id },
      data,
    });
  }

  return client.financialTransaction.create({ data });
};

export {
  resolveCategoryId,
  removeIncomeForPayment,
  removeExpenseForOrder,
  shouldSyncIncome,
  orderHasMultipleClients,
  syncIncomeFromPayment,
  syncExpenseFromOrder,
  syncAdditionalExpenseFromSale,
};
