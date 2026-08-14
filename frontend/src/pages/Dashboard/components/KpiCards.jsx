import React from 'react';
import { Circle, CheckCircle, DollarSign } from 'lucide-react';
import { formatBRL } from '../../../utils/money';

const kpiConfig = [
  {
    label: 'Total Pendente',
    key: 'totalPending',
    icon: Circle,
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-400',
    iconColor: 'text-red-500 dark:text-red-400',
    fill: 'fill-red-500 dark:fill-red-400',
  },
  {
    label: 'Total Quitado',
    key: 'totalPaid',
    icon: CheckCircle,
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-700 dark:text-green-400',
    iconColor: 'text-green-500 dark:text-green-400',
  },
  {
    label: 'Recebimentos (Mês Atual)',
    key: 'currentMonthReceipts',
    icon: DollarSign,
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-400',
    iconColor: 'text-blue-500 dark:text-blue-400',
  },
];

const KpiCards = ({ data }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {kpiConfig.map((kpi) => {
        const Icon = kpi.icon;
        const value = data?.[kpi.key] || 0;
        return (
          <div
            key={kpi.label}
            className={`p-4 rounded-lg border ${kpi.bg} ${kpi.border}`}
          >
            <div className="flex items-center gap-2 mb-2">
              {kpi.fill ? (
                <Icon className={`w-5 h-5 ${kpi.iconColor} ${kpi.fill}`} />
              ) : (
                <Icon className={`w-5 h-5 ${kpi.iconColor}`} />
              )}
              <span className={`text-sm font-medium ${kpi.text}`}>
                {kpi.label}
              </span>
            </div>
            <p className={`text-2xl font-bold ${kpi.text}`}>
              {formatBRL(value)}
            </p>
          </div>
        );
      })}
    </div>
  );
};

export default KpiCards;
