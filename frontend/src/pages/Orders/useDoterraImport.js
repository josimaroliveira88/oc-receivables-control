import { useCallback, useState } from 'react';
import { useToast } from '../../components/Toast';
import * as doterraOrdersApi from '../../services/doterraOrdersApi';

const emptyForm = () => ({ json: '' });

// Owns the "Importar pedidos dōTERRA" modal state: the pasted JSON, the import
// request and the per-order summary. On success it asks the page to refresh
// the orders list so the new pending-review orders show up.
export function useDoterraImport({ onImported } = {}) {
  const { addToast } = useToast();
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [summary, setSummary] = useState(null);

  const openImport = useCallback(() => {
    setForm(emptyForm());
    setImportError('');
    setSummary(null);
    setShowImport(true);
  }, []);

  const closeImport = useCallback(() => {
    setShowImport(false);
    setForm(emptyForm());
    setImportError('');
    setSummary(null);
  }, []);

  const setImportField = useCallback((field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setImportError('');
  }, []);

  const submitImport = useCallback(async () => {
    let parsed;
    try {
      parsed = JSON.parse(form.json);
    } catch (_err) {
      setImportError(
        'JSON inválido. Cole exatamente o texto gerado pela extensão.',
      );
      return;
    }

    const orders = Array.isArray(parsed) ? parsed : parsed?.orders;
    if (!Array.isArray(orders) || orders.length === 0) {
      setImportError('Nenhum pedido encontrado no JSON.');
      return;
    }

    setImporting(true);
    setImportError('');
    try {
      const { data } = await doterraOrdersApi.importOrders({ orders });
      setSummary(data);
      const createdCount = data.created?.length ?? 0;
      addToast(
        createdCount > 0
          ? `${createdCount} pedido(s) importado(s).`
          : 'Nenhum pedido novo para importar.',
        'success',
      );
      if (createdCount > 0 && onImported) onImported();
    } catch (err) {
      setImportError(
        err.response?.data?.error ||
          'Não foi possível importar os pedidos. Tente novamente.',
      );
    } finally {
      setImporting(false);
    }
  }, [form.json, addToast, onImported]);

  return {
    showImport,
    form,
    importing,
    importError,
    summary,
    openImport,
    closeImport,
    setImportField,
    submitImport,
  };
}
