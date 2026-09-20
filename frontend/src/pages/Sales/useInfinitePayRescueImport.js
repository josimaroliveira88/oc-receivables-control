import { useCallback, useState } from 'react';
import api from '../../services/api';
import {
  buildInitialAssignments,
  defaultAssignmentCents,
  isRescueBalanced,
  mergeAssignments,
} from './utils/infinitepayRescueHelpers';

// State and I/O for the InfinitePay redemption (resgate) statement import.
// Uploads the bank statement, keeps the parsed rescues with their suggested
// sales and the assignments the user confirms, commits them as a batch and can
// undo the whole batch afterwards. `onCommitted`/`onUndone` let the caller
// refresh the sales list.
export function useInfinitePayRescueImport({ onCommitted, onUndone } = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState('');
  const [batchId, setBatchId] = useState(null);
  const [rescues, setRescues] = useState([]);
  const [candidateSales, setCandidateSales] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [expandedLine, setExpandedLine] = useState(null);
  const [committedBatchId, setCommittedBatchId] = useState(null);
  const [committedCount, setCommittedCount] = useState(0);

  const reset = useCallback(() => {
    setIsOpen(false);
    setSubmitting(false);
    setCommitting(false);
    setError('');
    setBatchId(null);
    setRescues([]);
    setCandidateSales([]);
    setAssignments({});
    setExpandedLine(null);
    setCommittedBatchId(null);
    setCommittedCount(0);
  }, []);

  const importFile = useCallback(async (file) => {
    if (!file) return;

    setSubmitting(true);
    setError('');
    setBatchId(null);
    setRescues([]);
    setCandidateSales([]);
    setAssignments({});
    setExpandedLine(null);
    setCommittedBatchId(null);
    setCommittedCount(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post(
        '/sales/infinitepay-rescues/import',
        formData,
      );
      const rows = response.data?.rescues ?? [];
      setBatchId(response.data?.batchId ?? null);
      setRescues(rows);
      setCandidateSales(response.data?.candidateSales ?? []);
      setAssignments(buildInitialAssignments(rows));
      setIsOpen(true);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Não foi possível importar o extrato. Tente novamente.',
      );
      setIsOpen(true);
    } finally {
      setSubmitting(false);
    }
  }, []);

  const close = useCallback(() => reset(), [reset]);

  const toggleRow = useCallback((line) => {
    setExpandedLine((current) => (current === line ? null : line));
  }, []);

  // Assigns a single suggested sale to the whole rescue amount.
  const assignMatch = useCallback((line, match) => {
    setAssignments((previous) => ({
      ...previous,
      [line]: [{ orderId: match.saleId, amountCents: match.suggestedCents }],
    }));
  }, []);

  // Assigns a sale to one source deposit of a bundled rescue. The deposit key
  // makes the choice replaceable: picking another sale for the same deposit
  // swaps it instead of adding a second part.
  const assignFromDeposit = useCallback(
    (line, { depositKey, orderId, amountCents }) => {
      setAssignments((previous) => {
        const current = (previous[line] ?? []).filter(
          (assignment) => assignment.sourceKey !== depositKey,
        );
        return {
          ...previous,
          [line]: mergeAssignments([
            ...current,
            { orderId, amountCents, sourceKey: depositKey },
          ]),
        };
      });
    },
    [],
  );

  // Adds/removes a sale from the manual composition of a rescue.
  const toggleSale = useCallback((line, sale) => {
    setAssignments((previous) => {
      const current = previous[line] ?? [];
      const exists = current.some(
        (assignment) => assignment.orderId === sale.saleId,
      );
      const next = exists
        ? current.filter((assignment) => assignment.orderId !== sale.saleId)
        : mergeAssignments([
            ...current,
            {
              orderId: sale.saleId,
              amountCents: defaultAssignmentCents(sale),
            },
          ]);
      return { ...previous, [line]: next };
    });
  }, []);

  const setAssignmentAmount = useCallback((line, orderId, amountCents) => {
    setAssignments((previous) => ({
      ...previous,
      [line]: (previous[line] ?? []).map((assignment) =>
        assignment.orderId === orderId
          ? { ...assignment, amountCents }
          : assignment,
      ),
    }));
  }, []);

  const removeAssignment = useCallback((line, orderId) => {
    setAssignments((previous) => ({
      ...previous,
      [line]: (previous[line] ?? []).filter(
        (assignment) => assignment.orderId !== orderId,
      ),
    }));
  }, []);

  const commit = useCallback(async () => {
    const ready = rescues.filter((rescue) =>
      isRescueBalanced(assignments[rescue.line], rescue.amountCents),
    );

    if (ready.length === 0) {
      setError('Nenhum resgate pronto para confirmar.');
      return;
    }

    setCommitting(true);
    setError('');
    try {
      const payload = {
        batchId,
        rescues: ready.map((rescue) => ({
          line: rescue.line,
          rescueAmountCents: rescue.amountCents,
          transactionDate: rescue.date,
          assignments: (assignments[rescue.line] ?? []).map((assignment) => ({
            orderId: assignment.orderId,
            amountCents: assignment.amountCents,
          })),
        })),
      };
      const response = await api.post(
        '/sales/infinitepay-rescues/commit',
        payload,
      );
      setCommittedBatchId(response.data?.batchId ?? batchId);
      setCommittedCount(response.data?.created?.length ?? 0);
      if (typeof onCommitted === 'function') onCommitted();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Não foi possível confirmar os resgates. Tente novamente.',
      );
    } finally {
      setCommitting(false);
    }
  }, [assignments, batchId, rescues, onCommitted]);

  const undoCommitted = useCallback(async () => {
    if (!committedBatchId) return;

    setCommitting(true);
    setError('');
    try {
      await api.delete(`/finances/settlements/batch/${committedBatchId}`);
      if (typeof onUndone === 'function') onUndone();
      reset();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Não foi possível desfazer a importação. Tente novamente.',
      );
      setCommitting(false);
    }
  }, [committedBatchId, onUndone, reset]);

  return {
    isOpen,
    submitting,
    committing,
    error,
    batchId,
    rescues,
    candidateSales,
    assignments,
    expandedLine,
    committedBatchId,
    committedCount,
    importFile,
    close,
    toggleRow,
    assignMatch,
    assignFromDeposit,
    toggleSale,
    setAssignmentAmount,
    removeAssignment,
    commit,
    undoCommitted,
  };
}
