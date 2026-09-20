import React from 'react';
import { Upload } from 'lucide-react';

// Header of the sales page: title plus the import/create actions. The rescue
// import button is injected so this component does not own its hook.
const SalesToolbar = ({
  importSubmitting,
  importInputRef,
  onImportFile,
  onCreateSale,
  rescueImport = null,
}) => {
  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onImportFile(file);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-line px-6 py-4">
      <h2 className="text-xl font-semibold text-ink">Gestão de Vendas</h2>
      <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-0">
        {rescueImport}
        <button
          type="button"
          onClick={() => importInputRef.current?.click()}
          disabled={importSubmitting}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-line text-ink-soft hover:text-ink hover:bg-elevated font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          Importar InfinitePay
        </button>
        <button
          type="button"
          onClick={onCreateSale}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
        >
          Nova Venda
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          data-testid="infinitepay-file-input"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
};

export default SalesToolbar;
