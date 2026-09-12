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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        <span className="ml-2 text-ink-faint">Carregando...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface border border-line rounded-lg shadow-md">
        <div className="p-6">
          <div className="p-3 bg-danger-soft rounded-md">
            <p className="text-sm text-danger-fg">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-line rounded-lg shadow-md">
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
