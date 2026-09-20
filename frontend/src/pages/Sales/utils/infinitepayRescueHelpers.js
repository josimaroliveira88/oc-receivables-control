import { fromCents, formatBRL } from '../../../utils/money';

// Pure helpers for the InfinitePay redemption (resgate) statement import.

// Same tolerance the backend uses to match and to balance a rescue.
export const RESCUE_TOLERANCE_CENTS = 2;

export const formatRescueCents = (cents) => formatBRL(fromCents(cents));

// Human label for how a sale matched a redemption or a source deposit.
export const rescueMatchLabel = (matchType) =>
  ({
    net: 'Líquido InfinitePay',
    gross: 'Valor cobrado',
    total: 'Total da venda',
    pending: 'Saldo pendente',
    rescuable: 'Disponível p/ resgate',
  })[matchType] ?? matchType;

// Default amount proposed for a manually selected sale: what is still held by
// InfinitePay for it, falling back to the sale pending balance.
export const defaultAssignmentCents = (sale) =>
  sale.rescuableCents > 0 ? sale.rescuableCents : sale.pendingCents;

export const assignmentTotalCents = (assignments) =>
  (assignments || []).reduce(
    (sum, assignment) => sum + assignment.amountCents,
    0,
  );

export const isRescueBalanced = (
  assignments,
  rescueAmountCents,
  tolerance = RESCUE_TOLERANCE_CENTS,
) =>
  assignmentTotalCents(assignments) > 0 &&
  Math.abs(assignmentTotalCents(assignments) - rescueAmountCents) <= tolerance;

// Combines assignments that target the same sale into a single one.
export const mergeAssignments = (assignments) => {
  const byOrder = new Map();
  for (const assignment of assignments) {
    const current = byOrder.get(assignment.orderId);
    if (current) {
      current.amountCents += assignment.amountCents;
    } else {
      byOrder.set(assignment.orderId, { ...assignment });
    }
  }
  return [...byOrder.values()];
};

// Builds the pre-filled assignments for a preview: a rescue identified by a
// single sale gets that sale for the whole amount; a bundled rescue whose every
// deposit maps to exactly one sale gets the deposit composition. Everything
// else (ambiguous or unmatched) is left for the user to pick.
export const buildInitialAssignments = (rescues = []) => {
  const assignments = {};

  for (const rescue of rescues) {
    if (rescue.matches?.length === 1) {
      assignments[rescue.line] = [
        { orderId: rescue.matches[0].saleId, amountCents: rescue.amountCents },
      ];
      continue;
    }

    if (
      rescue.paired &&
      rescue.sourceDeposits?.length > 0 &&
      rescue.sourceDeposits.every((deposit) => deposit.matches?.length === 1)
    ) {
      assignments[rescue.line] = mergeAssignments(
        rescue.sourceDeposits.map((deposit) => ({
          orderId: deposit.matches[0].saleId,
          amountCents: deposit.amountCents,
        })),
      );
    }
  }

  return assignments;
};
