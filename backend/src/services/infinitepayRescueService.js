// Statement-import flow for InfinitePay redemptions. `previewRescueImport`
// parses the bank statement and suggests, for every redemption, the sales it
// likely came from; `commitRescueImport` turns the user's confirmed picks into
// the same ledger rows the single-settlement action creates, tagged with one
// batch id so the whole import can be undone at once.
import { randomUUID } from 'crypto';
import { toCents, fromCents } from '../utils/money.js';
import { badRequest } from '../utils/httpError.js';
import {
  parseBankStatement,
  BANK_STATEMENT_MATCH_TOLERANCE_CENTS,
} from '../utils/bankStatementParser.js';
import {
  decorateSaleForRescue,
  matchAmountToSales,
} from '../utils/rescueHelpers.js';
import {
  assertSettleableOrder,
  buildSettlementData,
} from './financeTransactionsService.js';

// Projects a decorated sale into the minimal shape the modal needs for the
// manual multi-select.
const toCandidateSale = (sale) => ({
  saleId: sale.id,
  orderNumber: sale.orderNumber,
  clientName: sale.clientName,
  totalCents: sale.totalCents,
  pendingCents: sale.pendingCents,
  rescuableCents: sale.rescuableCents,
});

// Loads the sale-level context used to match every redemption: the user's
// non-team sales that still have something to redeem, decorated with the
// InfinitePay payments and the amount already redeemed per order.
const loadRescueSales = async (client, userId) => {
  const orders = await client.order.findMany({
    where: { userId, orderType: 'VENDA', isTeamOrder: false },
    include: {
      items: { include: { person: true } },
      payments: true,
    },
  });

  if (orders.length === 0) return [];

  const settledRows = await client.financialTransaction.groupBy({
    by: ['orderId'],
    where: {
      userId,
      origin: 'RESGATE_INFINITEPAY',
      orderId: { in: orders.map((order) => order.id) },
    },
    _sum: { amount: true },
  });

  const settledCentsByOrder = Object.fromEntries(
    settledRows.map((row) => [row.orderId, toCents(row._sum.amount ?? 0)]),
  );

  return orders
    .map((order) => decorateSaleForRescue(order, settledCentsByOrder))
    .filter((sale) => sale.rescuableCents > 0);
};

// Parses the statement and decorates every rescue with the sales that match its
// amount and the sales that match each source deposit. Returns a fresh batch id
// the commit call must echo back.
const previewRescueImport = async (client, { userId, csvText }) => {
  const { rescues, ignoredDepositCount, ignoredRowCount } =
    parseBankStatement(csvText);

  const sales = await loadRescueSales(client, userId);
  const candidateSales = sales.map(toCandidateSale);

  const rescueRows = rescues.map((rescue) => ({
    ...rescue,
    matches: matchAmountToSales(rescue.amountCents, sales),
    sourceDeposits: rescue.sourceDeposits.map((deposit) => ({
      ...deposit,
      matches: matchAmountToSales(deposit.amountCents, sales),
    })),
  }));

  return {
    batchId: randomUUID(),
    rescues: rescueRows,
    candidateSales,
    ignoredDepositCount,
    ignoredRowCount,
  };
};

// Creates the confirmed redemptions in one transaction. Every rescue must be
// fully assigned (its parts sum to the redeemed amount within the tolerance)
// and every assignment must target a settleable sale owned by the user. An
// identical redemption already in the ledger aborts the whole import so the
// same statement can never be imported twice by accident.
const commitRescueImport = async (client, { userId, payload }) => {
  const { batchId, rescues } = payload;

  return client.$transaction(async (tx) => {
    const created = [];

    for (const rescue of rescues) {
      if (rescue.assignments.length === 0) {
        throw badRequest(
          'Cada resgate precisa estar associado a pelo menos uma venda',
        );
      }

      const sumCents = rescue.assignments.reduce(
        (sum, assignment) => sum + assignment.amountCents,
        0,
      );

      if (
        Math.abs(sumCents - rescue.rescueAmountCents) >
        BANK_STATEMENT_MATCH_TOLERANCE_CENTS
      ) {
        throw badRequest(
          'A soma das vendas não confere com o valor do resgate',
        );
      }

      for (const assignment of rescue.assignments) {
        const order = await assertSettleableOrder(
          tx,
          userId,
          assignment.orderId,
        );

        const data = await buildSettlementData(tx, {
          userId,
          order,
          amountCents: assignment.amountCents,
          transactionDate: rescue.transactionDate,
          notes: rescue.notes,
          importBatchId: batchId,
        });

        const duplicate = await tx.financialTransaction.findFirst({
          where: {
            userId,
            origin: 'RESGATE_INFINITEPAY',
            orderId: order.id,
            transactionDate: data.transactionDate,
            amount: data.amount,
          },
        });

        if (duplicate) {
          throw badRequest(
            `Já existe um resgate de ${fromCents(
              assignment.amountCents,
            ).toFixed(2)} para a venda ${order.orderNumber} nesta data`,
          );
        }

        const transaction = await tx.financialTransaction.create({
          data,
          include: { category: true, payment: true },
        });
        created.push(transaction);
      }
    }

    return created;
  });
};

export { previewRescueImport, commitRescueImport };
