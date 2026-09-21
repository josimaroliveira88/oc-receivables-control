// OFX statement reconciliation for credit-card installments. `previewReconcile`
// parses the file and suggests, per statement line, the pending installment
// whose amount matches within tolerance and whose date is closest; `commitReconcile`
// turns the user's confirmed picks into effective installments tagged with the
// batch id; `undoReconcileBatch` restores the touched installments. Matching is
// greedy by amount, with date proximity as the tiebreaker.
import { randomUUID } from 'node:crypto';
import { badRequest, notFound } from '../utils/httpError.js';
import { parseCreditCardOfx } from '../utils/creditCardOfxParser.js';

const MATCH_TOLERANCE_CENTS = 2;
const MAX_DAY_DISTANCE = 35;

// Calendar distance in whole days. `@db.Date` columns come back as UTC
// midnight, so the ISO date part is the intended calendar day; the statement
// date is a plain `YYYY-MM-DD`. Comparing string keys through `Date.UTC`
// avoids the local-timezone shift.
const daysBetweenKeys = (firstKey, secondKey) =>
  Math.abs(
    Date.UTC(...firstKey.split('-').map(Number)) -
      Date.UTC(...secondKey.split('-').map(Number)),
  ) /
  (1000 * 60 * 60 * 24);

const toDateKey = (value) => value.toISOString().slice(0, 10);

// Loads the pending installments plus the parent bill total. The Ourocard
// statement lists the purchase value once (`PARC 01/04`), not each parcel, so
// the line matches either the installment value (à vista) or the bill total
// (parcelado); the date proximity then picks the parcel the line pays.
const loadPendingInstallments = async (client, userId) => {
  const installments = await client.financialTransaction.findMany({
    where: {
      userId,
      creditCardBillId: { not: null },
      isEffective: false,
      installmentsTotal: { not: null },
      installmentNumber: { not: null },
    },
    include: { creditCardBill: { select: { totalCents: true } } },
    orderBy: [{ effectiveDate: 'asc' }, { createdAt: 'asc' }],
  });

  return installments.map((installment) => ({
    id: installment.id,
    billId: installment.creditCardBillId,
    description: installment.description,
    amountCents: Math.round(Number(installment.amount) * 100),
    billTotalCents: installment.creditCardBill?.totalCents ?? null,
    effectiveDate: installment.effectiveDate,
    effectiveKey: installment.effectiveDate
      ? toDateKey(installment.effectiveDate)
      : null,
    installmentNumber: installment.installmentNumber,
    installmentsTotal: installment.installmentsTotal,
  }));
};

const amountMatches = (row, amountCents) =>
  Math.abs(row.amountCents - amountCents) <= MATCH_TOLERANCE_CENTS ||
  (row.billTotalCents !== null &&
    Math.abs(row.billTotalCents - amountCents) <= MATCH_TOLERANCE_CENTS);

const previewReconcile = async (client, { userId, ofxText }) => {
  const statementLines = parseCreditCardOfx(ofxText);
  const rows = await loadPendingInstallments(client, userId);

  const usable = rows.filter((row) => row.effectiveDate);
  const consumed = new Set();

  const decoratedLines = statementLines.map((line) => {
    if (line.type !== 'PURCHASE' || line.ignoredReason) {
      return { ...line, matches: [], suggestedInstallmentId: null };
    }

    const candidates = usable
      .filter(
        (row) =>
          !consumed.has(row.id) &&
          amountMatches(row, line.amountCents) &&
          daysBetweenKeys(row.effectiveKey, line.date) <= MAX_DAY_DISTANCE,
      )
      .sort(
        (a, b) =>
          daysBetweenKeys(a.effectiveKey, line.date) -
          daysBetweenKeys(b.effectiveKey, line.date),
      );

    const matches = candidates.slice(0, 5);
    if (matches.length > 0) {
      consumed.add(matches[0].id);
    }

    return {
      ...line,
      matches,
      suggestedInstallmentId: matches[0]?.id ?? null,
    };
  });

  return {
    batchId: randomUUID(),
    statementLines: decoratedLines,
  };
};

const commitReconcile = async (client, { userId, batchId, matches }) =>
  client.$transaction(async (tx) => {
    const updated = [];

    for (const match of matches) {
      const installment = await tx.financialTransaction.findFirst({
        where: {
          id: match.installmentId,
          userId,
          creditCardBillId: { not: null },
          isEffective: false,
        },
      });

      if (!installment) {
        throw notFound('Pending installment not found');
      }

      const existingFitid = await tx.financialTransaction.findFirst({
        where: { userId, statementFitid: match.statementFitid },
      });
      if (existingFitid) {
        throw badRequest('Statement line already reconciled');
      }

      const statementDate = new Date(`${match.statementDate}T00:00:00`);

      const row = await tx.financialTransaction.update({
        where: { id: installment.id },
        data: {
          isEffective: true,
          effectiveDate: statementDate,
          statementFitid: match.statementFitid,
          importBatchId: batchId,
        },
      });
      updated.push(row);
    }

    return { batchId, updated };
  });

const undoReconcileBatch = async (client, { userId, batchId }) => {
  const result = await client.financialTransaction.updateMany({
    where: { userId, importBatchId: batchId },
    data: {
      isEffective: false,
      effectiveDate: null,
      statementFitid: null,
      importBatchId: null,
    },
  });

  return { batchId, restored: result.count };
};

export { previewReconcile, commitReconcile, undoReconcileBatch };
