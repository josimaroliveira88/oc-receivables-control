// OFX statement reconciliation for credit-card installments. `previewReconcile`
// parses the file and suggests, per statement line, the pending installment
// whose amount matches within tolerance and whose date is closest. When the memo
// carries `PARC nn/mm` the search is scoped to bills with that installment count
// and the matching installment number wins over date proximity; `commitReconcile`
// turns the user's confirmed picks into effective installments tagged with the
// batch id; `undoReconcileBatch` restores the touched installments. Matching is
// greedy (an installment is consumed by the first line that picks it).
import { randomUUID } from 'node:crypto';
import { badRequest, notFound } from '../utils/httpError.js';
import { parseCreditCardOfx } from '../utils/creditCardOfxParser.js';

const MIN_MATCH_TOLERANCE_CENTS = 2;
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

// Loads the pending installments plus the parent bill total. The statement line
// usually carries the installment value (`PARC 01/06` = R$ 185.65), but some
// statements list the full purchase value instead, so `amountMatches` accepts
// either the installment amount or the bill total; the date proximity then picks
// the parcel the line pays.
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

// The statement writes the installment value with the bank's rounding, which
// can differ from ours by up to `installments - 1` cents when the division has
// a remainder. The memo's `PARC nn/mm` tells us how many installments the
// purchase has, so the tolerance scales with it; without the memo we keep the
// cent-level tolerance used for à-vista lines.
const toleranceFor = (line) =>
  line.installmentsTotal
    ? Math.max(MIN_MATCH_TOLERANCE_CENTS, line.installmentsTotal - 1)
    : MIN_MATCH_TOLERANCE_CENTS;

const amountMatches = (row, amountCents, tolerance) =>
  Math.abs(row.amountCents - amountCents) <= tolerance ||
  (row.billTotalCents !== null &&
    Math.abs(row.billTotalCents - amountCents) <= tolerance);

// The `PARC nn/mm` memo scopes the search to bills split in the same number of
// installments; without it the amount/date window is the only filter.
const matchesInstallmentCount = (row, line) =>
  !line.installmentsTotal || row.installmentsTotal === line.installmentsTotal;

const matchesInstallmentNumber = (row, line) =>
  line.installmentNumber !== null &&
  row.installmentNumber === line.installmentNumber;

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
          matchesInstallmentCount(row, line) &&
          amountMatches(row, line.amountCents, toleranceFor(line)) &&
          daysBetweenKeys(row.effectiveKey, line.date) <= MAX_DAY_DISTANCE,
      )
      .sort((a, b) => {
        const aExact = matchesInstallmentNumber(a, line) ? 0 : 1;
        const bExact = matchesInstallmentNumber(b, line) ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        return (
          daysBetweenKeys(a.effectiveKey, line.date) -
          daysBetweenKeys(b.effectiveKey, line.date)
        );
      });

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
