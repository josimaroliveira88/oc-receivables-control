import React from 'react';
import { Download } from 'lucide-react';

const DashboardHeader = ({ exporting, canExport, onExport }) => {
  return (
    <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
        Dashboard
      </h2>
      <button
        onClick={onExport}
        disabled={exporting || !canExport}
        className="px-4 py-2 bg-gradient-to-r from-primary-700 to-primary-500 hover:from-primary-800 hover:to-primary-600 disabled:from-primary-400 disabled:to-primary-300 text-white text-sm font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {exporting ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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
