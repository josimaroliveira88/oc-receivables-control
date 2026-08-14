import React from 'react';
import { useDashboard } from './useDashboard';
import DashboardHeader from './components/DashboardHeader';
import KpiCards from './components/KpiCards';
import BalanceChart from './components/BalanceChart';
import YearlyBreakdown from './components/YearlyBreakdown';

const DashboardPage = () => {
  const {
    data,
    loading,
    error,
    exporting,
    handleExport,
    canExport,
    chartData,
  } = useDashboard();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2 text-gray-500 dark:text-gray-400">
          Carregando...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border-t-4 border-primary-600 dark:border-primary-400">
        <div className="p-6">
          <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border-t-4 border-primary-600 dark:border-primary-400">
        <DashboardHeader
          exporting={exporting}
          canExport={canExport}
          onExport={handleExport}
        />

        <div className="px-6 py-6">
          <KpiCards data={data} />
          <BalanceChart chartData={chartData} />
          <YearlyBreakdown yearlyBreakdown={data?.yearlyBreakdown} />
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
