import { useCallback, useState } from 'react';
import api from '../../services/api';
import { buildPaymentPrefill } from './utils/infinitepayHelpers';

// State and I/O for the InfinitePay statement import modal. Uploads the CSV,
// keeps the suggested matches, and opens the payment form pre-filled when the
// user picks a sale. Marking a row as used happens only after the payment is
// actually registered (via the `onDone` callback handed to the payment hook).
export function useInfinitePayImport({ openPrefilled } = {}) {
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

  // Opens the pre-filled payment form for a suggested sale. The import modal is
  // reopened when the payment form closes: on success the row is marked used,
  // on cancel it stays available.
  const selectSale = useCallback(
    async (row, match) => {
      if (typeof openPrefilled !== 'function') return;

      setSelecting(true);
      setError('');
      try {
        const response = await api.get(`/sales/${match.saleId}`);
        setIsOpen(false);
        openPrefilled(response.data, {
          ...buildPaymentPrefill(row, match),
          onDone: (submitted) => {
            if (submitted) {
              setUsedLines((previous) => new Set(previous).add(row.line));
            }
            setIsOpen(true);
          },
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
    [openPrefilled],
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
