import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  brlTooltipFormatter,
  brlTickFormatter,
} from '../utils/dashboardHelpers';

const BalanceChart = ({ chartData }) => {
  if (chartData.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">
          Nenhum saldo por pessoa
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
        Saldos por Pessoa
      </h3>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="name" stroke="#9CA3AF" />
          <YAxis tickFormatter={brlTickFormatter} stroke="#9CA3AF" />
          <Tooltip formatter={brlTooltipFormatter} />
          <Legend />
          <Bar dataKey="Itens" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Pagamentos" fill="#22c55e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BalanceChart;
