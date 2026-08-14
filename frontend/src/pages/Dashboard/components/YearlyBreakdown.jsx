import React from 'react';
import { formatBRL } from '../../../utils/money';

const YearlyBreakdown = ({ yearlyBreakdown }) => {
  if (!yearlyBreakdown || yearlyBreakdown.length === 0) {
    return (
      <div className="text-center py-12 mt-8">
        <p className="text-gray-500 dark:text-gray-400">Nenhum dado por ano</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
        Resumo por Ano
      </h3>
      <div>
        <table
          className="w-full text-sm block md:table"
          data-testid="yearly-breakdown"
        >
          <thead className="hidden md:table-header-group">
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                Ano
              </th>
              <th className="text-right py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                Pendente
              </th>
              <th className="text-right py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                Quitado
              </th>
            </tr>
          </thead>
          <tbody className="block md:table-row-group">
            {yearlyBreakdown.map((yearData) => (
              <tr
                key={yearData.year}
                className="block md:table-row border border-gray-200 dark:border-gray-700 md:border-0 rounded-lg md:rounded-none shadow-sm md:shadow-none mb-3 md:mb-0 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <td
                  data-label="Ano"
                  className="block md:table-cell py-2 md:py-3 px-4 font-medium text-gray-800 dark:text-gray-200 before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase md:before:hidden"
                >
                  {yearData.year}
                </td>
                <td
                  data-label="Pendente"
                  className="block md:table-cell py-2 md:py-3 px-4 text-left md:text-right text-red-600 dark:text-red-400 font-medium before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase md:before:hidden"
                >
                  {formatBRL(yearData.totalPending)}
                </td>
                <td
                  data-label="Quitado"
                  className="block md:table-cell py-2 md:py-3 px-4 text-left md:text-right text-green-600 dark:text-green-400 font-medium before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-gray-500 dark:before:text-gray-400 before:mb-1 before:uppercase md:before:hidden"
                >
                  {formatBRL(yearData.totalQuitado)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default YearlyBreakdown;
