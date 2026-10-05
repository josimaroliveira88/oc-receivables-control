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

// An Uber expense converted to a credit-card purchase keeps its ride link, and
// the ride date is no longer necessarily `transactionDate` (which becomes the
// card charge date). The relation is exposed to the UI so the ride date can
// still be shown next to the entry.
const rideSelect = {
  select: {
    requestedAt: true,
    destination: true,
    riderName: true,
    rideType: true,
  },
};

const transactionInclude = {
  category: true,
  payment: true,
  ride: rideSelect,
};

const buildWhere = (userId, query = {}) => {
  const where = { userId };

  if (query.type) where.type = query.type;
  if (query.origin) where.origin = query.origin;
  if (query.categoryId) where.categoryId = query.categoryId;

  // Ownership always wins: the userId scoping above cannot be overridden even
  // when a foreign orderId is supplied.
  if (query.orderId) where.orderId = query.orderId;

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
    include: transactionInclude,
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
    include: transactionInclude,
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
    include: transactionInclude,
  });

  return decorateTransaction(transaction);
};

const deleteManualTransaction = async (client, { userId, id }) => {
  const existing = await findOwnedTransaction(client, userId, id);
  assertManual(existing);

  await client.financialTransaction.delete({ where: { id } });
};

// Origins whose rows may be deleted through this endpoint. Automatic rows are
// owned by their source, except UBER rows: deleting one frees its ride to be
// launched again.
const DELETABLE_ORIGINS = new Set(['MANUAL', 'UBER']);

// Credit-card fields for an Uber edit. `paymentType` is the switch: CARTAO_CREDITO
// turns the row into a pending card purchase that carries the invoice (fatura)
// date, while null reverts it to a plain entry. When the field is omitted the
// card state is left untouched. The invoice can never precede the charge date.
const buildUberCardData = (existing, payload) => {
  if (payload.paymentType === undefined) return {};

  if (payload.paymentType === null) {
    return { paymentType: null, effectiveDate: null, isEffective: true };
  }

  if (!payload.effectiveDate) {
    throw badRequest('Informe a data da fatura do cartão de crédito');
  }

  const invoiceDate = parseLocalDate(payload.effectiveDate);
  const chargeDate = payload.transactionDate
    ? parseLocalDate(payload.transactionDate)
    : existing.transactionDate;

  if (invoiceDate.getTime() < chargeDate.getTime()) {
    throw badRequest(
      'A data da fatura não pode ser anterior à data do lançamento no cartão',
    );
  }

  return {
    paymentType: 'CARTAO_CREDITO',
    effectiveDate: invoiceDate,
    isEffective: false,
  };
};

// Applies a partial update according to the row's origin:
// - MANUAL: every field (existing behaviour).
// - UBER: everything but `type`/`origin` (the ride-derived nature is fixed).
//   The row can also be converted into a pending credit-card purchase (charge
//   date = transactionDate, invoice date = effectiveDate) and reverted.
// - other automatic origins: only the description; amount/date/category are
//   derived from the source and are re-synced when it changes.
const updateTransaction = async (client, { userId, id, payload }) => {
  const existing = await findOwnedTransaction(client, userId, id);

  if (existing.origin === 'MANUAL') {
    return updateManualTransaction(client, { userId, id, payload });
  }

  if (existing.origin === 'UBER') {
    if (payload.categoryId !== undefined) {
      await assertCategoryMatches(client, userId, {
        categoryId: payload.categoryId,
        type: existing.type,
      });
    }

    const cardData = buildUberCardData(existing, payload);

    const transaction = await client.financialTransaction.update({
      where: { id },
      data: {
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
        ...cardData,
      },
      include: transactionInclude,
    });

    return decorateTransaction(transaction);
  }

  const transaction = await client.financialTransaction.update({
    where: { id },
    data: {
      ...(payload.description !== undefined && {
        description: payload.description,
      }),
    },
    include: transactionInclude,
  });

  return decorateTransaction(transaction);
};

const deleteTransaction = async (client, { userId, id }) => {
  const existing = await findOwnedTransaction(client, userId, id);

  if (!DELETABLE_ORIGINS.has(existing.origin)) {
    throw badRequest(
      'Somente lançamentos manuais ou de corrida Uber podem ser excluídos',
    );
  }

  await client.financialTransaction.delete({ where: { id } });
};

// A credit-card Uber expense is settled (baixada) once its invoice is paid,
// mirroring the per-installment pay/unpay of the credit-card module. There is no
// bill to recompute the scheduled date from, so the invoice date in
// `effectiveDate` is preserved and only `isEffective` flips. Both operations are
// idempotent and restricted to Uber card rows.
const assertCardUber = (transaction) => {
  if (
    transaction.origin !== 'UBER' ||
    transaction.paymentType !== 'CARTAO_CREDITO'
  ) {
    throw badRequest(
      'Somente lançamentos de corrida Uber no cartão de crédito podem ser baixados',
    );
  }
};

const payCardTransaction = async (client, { userId, id }) => {
  const existing = await findOwnedTransaction(client, userId, id);
  assertCardUber(existing);

  const transaction = await client.financialTransaction.update({
    where: { id },
    data: { isEffective: true },
    include: transactionInclude,
  });

  return decorateTransaction(transaction);
};

const unpayCardTransaction = async (client, { userId, id }) => {
  const existing = await findOwnedTransaction(client, userId, id);
  assertCardUber(existing);

  const transaction = await client.financialTransaction.update({
    where: { id },
    data: { isEffective: false },
    include: transactionInclude,
  });

  return decorateTransaction(transaction);
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
    include: transactionInclude,
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
  updateTransaction,
  deleteManualTransaction,
  deleteTransaction,
  payCardTransaction,
  unpayCardTransaction,
  assertSettleableOrder,
  buildSettlementData,
  createSettlement,
  deleteRescue,
  deleteRescueBatch,
  getSummary,
};
