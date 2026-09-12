import React from 'react';
import { Circle, CheckCircle, DollarSign } from 'lucide-react';
import { formatBRL } from '../../../utils/money';

const kpiConfig = [
  {
    label: 'Total Pendente',
    key: 'totalPending',
    icon: Circle,
    bg: 'bg-danger-soft',
    text: 'text-danger-fg',
    iconColor: 'text-danger-fg',
    fill: 'fill-danger-fg',
  },
  {
    label: 'Total Quitado',
    key: 'totalPaid',
    icon: CheckCircle,
    bg: 'bg-success-soft',
    text: 'text-success-fg',
    iconColor: 'text-success-fg',
  },
  {
    label: 'Recebimentos (Mês Atual)',
    key: 'currentMonthReceipts',
    icon: DollarSign,
    bg: 'bg-accent-soft',
    text: 'text-accent-on-soft',
    iconColor: 'text-accent',
  },
];

const KpiCards = ({ data }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {kpiConfig.map((kpi) => {
        const Icon = kpi.icon;
        const value = data?.[kpi.key] || 0;
        return (
          <div key={kpi.label} className={`p-4 rounded-lg ${kpi.bg}`}>
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
