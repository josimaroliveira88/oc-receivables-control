import { useCallback, useState } from 'react';
import * as creditCardsApi from '../../services/creditCardsApi';
import { errorMessageFrom } from '../Finances/utils/financeHelpers';
import { buildReconcileSelections } from './utils/creditCardHelpers';

const readFileText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });

export function useCreditCardReconcile({ onCommitted, onUndone } = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState('');
  const [batchId, setBatchId] = useState(null);
  const [statementLines, setStatementLines] = useState([]);
  const [selections, setSelections] = useState({});
  const [committedBatchId, setCommittedBatchId] = useState(null);
  const [committedCount, setCommittedCount] = useState(0);

  const open = () => {
    setError('');
    setBatchId(null);
    setStatementLines([]);
    setSelections({});
    setCommittedBatchId(null);
    setCommittedCount(0);
    setIsOpen(true);
  };

  const close = () => setIsOpen(false);

  const importFile = useCallback(async (file) => {
    if (!file) return;

    setSubmitting(true);
    setError('');
    setBatchId(null);
    setStatementLines([]);
    setSelections({});
    setCommittedBatchId(null);
    setCommittedCount(0);

    try {
      const ofxText = await readFileText(file);
      const response = await creditCardsApi.previewReconcile(ofxText);
      const lines = response.data?.statementLines ?? [];
      setBatchId(response.data?.batchId ?? null);
      setStatementLines(lines);
      setSelections(buildReconcileSelections(lines));
    } catch (err) {
      setError(
        errorMessageFrom(
          err,
          'Não foi possível ler o extrato OFX. Tente novamente.',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }, []);

  const setSelection = useCallback((fitid, installmentId) => {
    setSelections((previous) => ({
      ...previous,
      [fitid]: installmentId || '',
    }));
  }, []);

  const commit = useCallback(async () => {
    const matches = statementLines
      .filter((line) => selections[line.fitid])
      .map((line) => ({
        statementFitid: line.fitid,
        statementDate: line.date,
        installmentId: selections[line.fitid],
      }));

    if (matches.length === 0) {
      setError('Selecione ao menos uma parcela para conciliar.');
      return;
    }

    setCommitting(true);
    setError('');
    try {
      const response = await creditCardsApi.commitReconcile({
        batchId,
        matches,
      });
      setCommittedBatchId(response.data?.batchId ?? batchId);
      setCommittedCount(response.data?.updated?.length ?? matches.length);
      setIsOpen(false);
      if (typeof onCommitted === 'function') onCommitted();
    } catch (err) {
      setError(
        errorMessageFrom(
          err,
          'Não foi possível confirmar a conciliação. Tente novamente.',
        ),
      );
    } finally {
      setCommitting(false);
    }
  }, [batchId, statementLines, selections, onCommitted]);

  const undoCommitted = useCallback(async () => {
    if (!committedBatchId) return;

    setCommitting(true);
    setError('');
    try {
      await creditCardsApi.undoReconcileBatch(committedBatchId);
      setCommittedBatchId(null);
      setCommittedCount(0);
      if (typeof onUndone === 'function') onUndone();
    } catch (err) {
      setError(
        errorMessageFrom(
          err,
          'Não foi possível desfazer a conciliação. Tente novamente.',
        ),
      );
    } finally {
      setCommitting(false);
    }
  }, [committedBatchId, onUndone]);

  return {
    isOpen,
    submitting,
    committing,
    error,
    batchId,
    statementLines,
    selections,
    committedBatchId,
    committedCount,
    open,
    close,
    importFile,
    setSelection,
    commit,
    undoCommitted,
  };
}
