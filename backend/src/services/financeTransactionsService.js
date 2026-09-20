// Manual financial transactions plus the filtered listing and period summary
// shared by the finances page. `client` is a Prisma client (or transaction
// client) and every read/write is scoped by `userId`.
//
// Only `origin = MANUAL` rows can be edited or deleted. Automatic rows are
// derived data owned by the payment/order that produced them, so the user edits
// the source instead (see financeSyncService).
import { fromCents, toCents } from '../utils/money.js';
import { paymentFeeCents } from '../utils/paymentFee.js';
import { parseLocalDate } from '../utils/date.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { assertCategoryMatches } from '../utils/financeCategory.js';
import { resolveCategoryId } from './financeSyncService.js';

// Adds the derived gateway fee (informative only) when the row is linked to a
// payment, mirroring the payments response. Never a stored column.
const decorateTransaction = (transaction) => ({
  ...transaction,
  feeAmount: transaction.payment
    ? fromCents(paymentFeeCents(transaction.payment)).toFixed(2)
    : null,
});

const buildWhere = (userId, query = {}) => {
  const where = { userId };

  if (query.type) where.type = query.type;
  if (query.origin) where.origin = query.origin;
  if (query.categoryId) where.categoryId = query.categoryId;

  if (query.from || query.to) {
    where.transactionDate = {};
    if (query.from) where.transactionDate.gte = parseLocalDate(query.from);
    if (query.to) where.transactionDate.lte = parseLocalDate(query.to);
  }

  if (query.q && query.q.trim()) {
    const term = query.q.trim();
    where.OR = [
      { description: { contains: term, mode: 'insensitive' } },
      { notes: { contains: term, mode: 'insensitive' } },
    ];
  }

  return where;
};

const findOwnedTransaction = async (client, userId, id) => {
  const transaction = await client.financialTransaction.findFirst({
    where: { id, userId },
  });

  if (!transaction) {
    throw notFound('Transaction not found');
  }

  return transaction;
};

const assertManual = (transaction) => {
  if (transaction.origin !== 'MANUAL') {
    throw badRequest('Automatic transactions cannot be edited or deleted');
  }
};

const listTransactions = async (client, { userId, query }) => {
  const transactions = await client.financialTransaction.findMany({
    where: buildWhere(userId, query),
    include: { category: true, payment: true },
    orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
  });

  return transactions.map(decorateTransaction);
};

const createManualTransaction = async (client, { userId, payload }) => {
  await assertCategoryMatches(client, userId, {
    categoryId: payload.categoryId,
    type: payload.type,
  });

  const transaction = await client.financialTransaction.create({
    data: {
      userId,
      type: payload.type,
      origin: 'MANUAL',
      amount: payload.amount,
      description: payload.description,
      transactionDate: parseLocalDate(payload.transactionDate),
      notes: payload.notes ?? null,
      categoryId: payload.categoryId ?? null,
    },
    include: { category: true, payment: true },
  });

  return decorateTransaction(transaction);
};

const updateManualTransaction = async (client, { userId, id, payload }) => {
  const existing = await findOwnedTransaction(client, userId, id);
  assertManual(existing);

  // The category must match the type the row will have after the update, which
  // may come from the payload or stay as the stored one.
  const effectiveType = payload.type ?? existing.type;
  if (payload.categoryId !== undefined) {
    await assertCategoryMatches(client, userId, {
      categoryId: payload.categoryId,
      type: effectiveType,
    });
  }

  const transaction = await client.financialTransaction.update({
    where: { id },
    data: {
      ...(payload.type !== undefined && { type: payload.type }),
      ...(payload.amount !== undefined && { amount: payload.amount }),
      ...(payload.description !== undefined && {
        description: payload.description,
      }),
      ...(payload.transactionDate !== undefined && {
        transactionDate: parseLocalDate(payload.transactionDate),
      }),
      ...(payload.categoryId !== undefined && {
        categoryId: payload.categoryId,
      }),
      ...(payload.notes !== undefined && { notes: payload.notes }),
    },
    include: { category: true, payment: true },
  });

  return decorateTransaction(transaction);
};

const deleteManualTransaction = async (client, { userId, id }) => {
  const existing = await findOwnedTransaction(client, userId, id);
  assertManual(existing);

  await client.financialTransaction.delete({ where: { id } });
};

// Registers an InfinitePay redemption for a sale. The money only enters the
// ledger when the user redeems it in the InfinitePay portal, so this explicit
// action creates a linked income row (multiple partial redemptions allowed).
// The gross charged value stays on the sale payments; the implicit gateway fee
// is informative only and is never persisted.
const createSettlement = async (client, { userId, payload }) => {
  const order = await client.order.findFirst({
    where: { id: payload.orderId, userId },
    include: { payments: { select: { paymentType: true } } },
  });

  if (!order) {
    throw notFound('Order not found');
  }

  if (order.orderType !== 'VENDA') {
    throw badRequest('Settlements are only available for sales');
  }

  if (order.isTeamOrder) {
    throw badRequest('Team orders do not accept settlements');
  }

  const hasInfinitePayPayment = order.payments.some(
    (payment) => payment.paymentType === 'INFINITE_PAY',
  );

  if (!hasInfinitePayPayment) {
    throw badRequest('Sale has no InfinitePay payment to settle');
  }

  const transaction = await client.financialTransaction.create({
    data: {
      userId,
      type: 'RECEITA',
      origin: 'RESGATE_INFINITEPAY',
      amount: payload.amount,
      description: `Resgate InfinitePay — Venda ${order.orderNumber}`,
      transactionDate: parseLocalDate(payload.transactionDate),
      notes: payload.notes ?? null,
      categoryId: await resolveCategoryId(
        client,
        userId,
        'RESGATE_INFINITEPAY',
      ),
      orderId: order.id,
      paymentId: null,
    },
    include: { category: true, payment: true },
  });

  return decorateTransaction(transaction);
};

// Totals for the whole filtered set (never a page), computed in integer cents.
const getSummary = async (client, { userId, query }) => {
  const groups = await client.financialTransaction.groupBy({
    by: ['type'],
    where: buildWhere(userId, query),
    _sum: { amount: true },
  });

  let incomeCents = 0;
  let expenseCents = 0;

  for (const group of groups) {
    const sumCents = toCents(group._sum.amount ?? 0);
    if (group.type === 'RECEITA') incomeCents += sumCents;
    if (group.type === 'DESPESA') expenseCents += sumCents;
  }

  return {
    totalIncome: fromCents(incomeCents).toFixed(2),
    totalExpense: fromCents(expenseCents).toFixed(2),
    balance: fromCents(incomeCents - expenseCents).toFixed(2),
  };
};

export {
  buildWhere,
  listTransactions,
  createManualTransaction,
  updateManualTransaction,
  deleteManualTransaction,
  createSettlement,
  getSummary,
};
