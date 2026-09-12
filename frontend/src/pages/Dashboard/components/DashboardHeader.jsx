import React from 'react';
import { Download } from 'lucide-react';

const DashboardHeader = ({ exporting, canExport, onExport }) => {
  return (
    <div className="border-b border-line px-6 py-4 flex items-center justify-between">
      <h2 className="text-xl font-semibold text-ink">Dashboard</h2>
      <button
        onClick={onExport}
        disabled={exporting || !canExport}
        className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on text-sm font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {exporting ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent-on"></div>
            Exportando...
          </>
        ) : (
          <>
            <Download className="w-4 h-4" /> Exportar para Excel
          </>
        )}
      </button>
    </div>
  );
};

export default DashboardHeader;
