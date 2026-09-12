import React from 'react';
import { formatBRL } from '../../../utils/money';

const YearlyBreakdown = ({ yearlyBreakdown }) => {
  if (!yearlyBreakdown || yearlyBreakdown.length === 0) {
    return (
      <div className="text-center py-12 mt-8">
        <p className="text-ink-faint">Nenhum dado por ano</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h3 className="text-lg font-medium text-ink-soft mb-4">Resumo por Ano</h3>
      <div>
        <table
          className="w-full text-sm block md:table"
          data-testid="yearly-breakdown"
        >
          <thead className="hidden md:table-header-group">
            <tr className="border-b border-line">
              <th className="text-left py-3 px-4 font-medium text-ink-soft">
                Ano
              </th>
              <th className="text-right py-3 px-4 font-medium text-ink-soft">
                Pendente
              </th>
              <th className="text-right py-3 px-4 font-medium text-ink-soft">
                Quitado
              </th>
            </tr>
          </thead>
          <tbody className="block md:table-row-group">
            {yearlyBreakdown.map((yearData) => (
              <tr
                key={yearData.year}
                className="block md:table-row border border-line md:border-0 rounded-lg md:rounded-none shadow-sm md:shadow-none mb-3 md:mb-0 hover:bg-accent-soft transition-colors"
              >
                <td
                  data-label="Ano"
                  className="block md:table-cell py-2 md:py-3 px-4 font-medium text-ink before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 md:before:hidden"
                >
                  {yearData.year}
                </td>
                <td
                  data-label="Pendente"
                  className="block md:table-cell py-2 md:py-3 px-4 text-left md:text-right text-danger-fg font-medium before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 md:before:hidden"
                >
                  {formatBRL(yearData.totalPending)}
                </td>
                <td
                  data-label="Quitado"
                  className="block md:table-cell py-2 md:py-3 px-4 text-left md:text-right text-success-fg font-medium before:content-[attr(data-label)] before:block before:text-xs before:font-semibold before:text-ink-faint before:mb-1 md:before:hidden"
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
