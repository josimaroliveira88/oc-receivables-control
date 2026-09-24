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
// payment, mirroring the payments response. Never a stored column. The
// effectiveness, installment and credit-card fields are already persisted
// columns, so spreading the row keeps them available to the frontend without a
// second fetch.
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

  if (query.effective === 'yes') where.isEffective = true;
  if (query.effective === 'no') where.isEffective = false;

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
    throw notFound('Transação não encontrada');
  }

  return transaction;
};

const assertManual = (transaction) => {
  if (transaction.origin !== 'MANUAL') {
    throw badRequest(
      'Transações automáticas não podem ser editadas ou excluídas',
    );
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

// Validates that an order can receive an InfinitePay redemption and returns it.
// Shared by the single-settlement action and the bulk statement import so both
// enforce the same ownership and sale-only rules.
const assertSettleableOrder = async (client, userId, orderId) => {
  const order = await client.order.findFirst({
    where: { id: orderId, userId },
    include: { payments: { select: { paymentType: true } } },
  });

  if (!order) {
    throw notFound('Pedido não encontrado');
  }

  if (order.orderType !== 'VENDA') {
    throw badRequest('Os resgates estão disponíveis apenas para vendas');
  }

  if (order.isTeamOrder) {
    throw badRequest('Pedidos de equipe não aceitam resgates');
  }

  const hasInfinitePayPayment = order.payments.some(
    (payment) => payment.paymentType === 'INFINITE_PAY',
  );

  if (!hasInfinitePayPayment) {
    throw badRequest('A venda não possui pagamento InfinitePay para resgatar');
  }

  return order;
};

// Builds the ledger row for an InfinitePay redemption of a sale. The money only
// enters the ledger when the user redeems it in the InfinitePay portal, so the
// explicit action creates a linked income row (multiple partial redemptions are
// allowed). The gross charged value stays on the sale payments; the implicit
// gateway fee is informative only and is never persisted.
const buildSettlementData = async (
  client,
  { userId, order, amountCents, transactionDate, notes, importBatchId },
) => ({
  userId,
  type: 'RECEITA',
  origin: 'RESGATE_INFINITEPAY',
  amount: fromCents(amountCents),
  description: `Resgate InfinitePay — Venda ${order.orderNumber}`,
  transactionDate: parseLocalDate(transactionDate),
  notes: notes ?? null,
  categoryId: await resolveCategoryId(client, userId, 'RESGATE_INFINITEPAY'),
  orderId: order.id,
  paymentId: null,
  importBatchId: importBatchId ?? null,
});

// Registers a single InfinitePay redemption for a sale.
const createSettlement = async (client, { userId, payload }) => {
  const order = await assertSettleableOrder(client, userId, payload.orderId);

  const transaction = await client.financialTransaction.create({
    data: await buildSettlementData(client, {
      userId,
      order,
      amountCents: Math.round(payload.amount * 100),
      transactionDate: payload.transactionDate,
      notes: payload.notes,
      importBatchId: payload.importBatchId,
    }),
    include: { category: true, payment: true },
  });

  return decorateTransaction(transaction);
};

// Undoes a redemption created from a statement import (or a manual one). Only
// RESGATE_INFINITEPAY rows can be undone here; automatic rows are owned by
// their source and manual rows use the generic delete.
const deleteRescue = async (client, { userId, id }) => {
  const existing = await findOwnedTransaction(client, userId, id);

  if (existing.origin !== 'RESGATE_INFINITEPAY') {
    throw badRequest('Somente resgates do InfinitePay podem ser desfeitos');
  }

  await client.financialTransaction.delete({ where: { id } });
};

// Undoes every redemption created by a single statement import. Idempotent: an
// already-cleared batch deletes nothing and returns 0.
const deleteRescueBatch = async (client, { userId, batchId }) => {
  const result = await client.financialTransaction.deleteMany({
    where: {
      userId,
      origin: 'RESGATE_INFINITEPAY',
      importBatchId: batchId,
    },
  });

  return result.count;
};

// Totals for the whole filtered set (never a page), computed in integer cents.
// Only effective rows feed income/expense/balance; pending rows (credit-card
// installments not yet reconciled) are reported separately as `pendingTotal`.
const getSummary = async (client, { userId, query }) => {
  const baseWhere = buildWhere(userId, query);

  const groups = await client.financialTransaction.groupBy({
    by: ['type'],
    where: { ...baseWhere, isEffective: true },
    _sum: { amount: true },
  });

  let incomeCents = 0;
  let expenseCents = 0;

  for (const group of groups) {
    const sumCents = toCents(group._sum.amount ?? 0);
    if (group.type === 'RECEITA') incomeCents += sumCents;
    if (group.type === 'DESPESA') expenseCents += sumCents;
  }

  const pending = await client.financialTransaction.aggregate({
    where: { ...baseWhere, isEffective: false },
    _sum: { amount: true },
  });
  const pendingCents = toCents(pending._sum.amount ?? 0);

  return {
    totalIncome: fromCents(incomeCents).toFixed(2),
    totalExpense: fromCents(expenseCents).toFixed(2),
    balance: fromCents(incomeCents - expenseCents).toFixed(2),
    pendingTotal: fromCents(pendingCents).toFixed(2),
  };
};

export {
  buildWhere,
  findOwnedTransaction,
  listTransactions,
  createManualTransaction,
  updateManualTransaction,
  deleteManualTransaction,
  assertSettleableOrder,
  buildSettlementData,
  createSettlement,
  deleteRescue,
  deleteRescueBatch,
  getSummary,
};
