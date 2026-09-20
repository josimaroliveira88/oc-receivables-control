import { useCallback, useState } from 'react';
import api from '../../services/api';
import {
  buildEditPaymentPrefill,
  buildPaymentPrefill,
} from './utils/infinitepayHelpers';

// The payment the import should correct when the matched sale already carries
// an InfinitePay charge: the most recently registered one (by `createdAt`).
const findInfinitePayPayment = (sale) =>
  [...(sale?.payments ?? [])]
    .filter((payment) => payment.paymentType === 'INFINITE_PAY')
    .sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime(),
    )[0] ?? null;

// State and I/O for the InfinitePay statement import modal. Uploads the CSV,
// keeps the suggested matches, and opens the payment form pre-filled when the
// user picks a sale. When the sale already has an InfinitePay payment the edit
// form is opened with the statement values, so the user corrects the existing
// charge instead of creating a duplicate. Marking a row as used happens only
// after the form is submitted (via the `onDone` callback handed to the hook).
export function useInfinitePayImport({
  openPrefilled,
  openEditPrefilled,
} = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [ignoredCount, setIgnoredCount] = useState(0);
  const [usedLines, setUsedLines] = useState(() => new Set());
  const [expandedLine, setExpandedLine] = useState(null);

  const reset = useCallback(() => {
    setIsOpen(false);
    setSubmitting(false);
    setSelecting(false);
    setError('');
    setRows([]);
    setIgnoredCount(0);
    setUsedLines(new Set());
    setExpandedLine(null);
  }, []);

  const importFile = useCallback(async (file) => {
    if (!file) return;

    setSubmitting(true);
    setSelecting(false);
    setError('');
    setRows([]);
    setIgnoredCount(0);
    setUsedLines(new Set());
    setExpandedLine(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/sales/infinitepay/import', formData);
      setRows(response.data?.rows ?? []);
      setIgnoredCount(response.data?.ignoredCount ?? 0);
      setIsOpen(true);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Não foi possível importar o arquivo. Tente novamente.',
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

  // Opens the pre-filled payment form for a suggested sale: the edit form when
  // the sale already has an InfinitePay payment, the create form otherwise. The
  // import modal is reopened when the form closes: on success the row is marked
  // used, on cancel it stays available.
  const selectSale = useCallback(
    async (row, match) => {
      if (
        typeof openPrefilled !== 'function' &&
        typeof openEditPrefilled !== 'function'
      ) {
        return;
      }

      setSelecting(true);
      setError('');
      try {
        const response = await api.get(`/sales/${match.saleId}`);
        const sale = response.data;
        const existingInfinitePay = findInfinitePayPayment(sale);
        setIsOpen(false);

        const onDone = (submitted) => {
          if (submitted) {
            setUsedLines((previous) => new Set(previous).add(row.line));
          }
          setIsOpen(true);
        };

        if (existingInfinitePay && typeof openEditPrefilled === 'function') {
          openEditPrefilled(sale, existingInfinitePay, {
            ...buildEditPaymentPrefill(row, match, existingInfinitePay),
            onDone,
          });
          return;
        }

        openPrefilled(sale, {
          ...buildPaymentPrefill(row, match),
          onDone,
        });
      } catch (err) {
        setError(
          err.response?.data?.error ||
            'Não foi possível abrir a venda selecionada.',
        );
      } finally {
        setSelecting(false);
      }
    },
    [openPrefilled, openEditPrefilled],
  );

  return {
    isOpen,
    submitting,
    selecting,
    error,
    rows,
    ignoredCount,
    usedLines,
    expandedLine,
    importFile,
    close,
    toggleRow,
    selectSale,
  };
}
