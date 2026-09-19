import React from 'react';
import { TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { formatBRL } from '../../../utils/money';

const SummaryCard = ({ icon: Icon, label, value, valueClass, testId }) => (
  <div className="rounded-lg border border-line bg-surface px-4 py-3">
    <div className="flex items-center gap-2 text-ink-faint">
      <Icon className="w-4 h-4" aria-hidden="true" />
      <span className="text-xs font-medium">{label}</span>
    </div>
    <p
      data-testid={testId}
      className={`mt-1 text-lg font-semibold ${valueClass}`}
    >
      {value}
    </p>
  </div>
);

const FinancesSummary = ({ summary }) => {
  const income = summary ? parseFloat(summary.totalIncome) : 0;
  const expense = summary ? parseFloat(summary.totalExpense) : 0;
  const balance = summary ? parseFloat(summary.balance) : 0;

  const balanceClass = balance < 0 ? 'text-danger-fg' : 'text-success-fg';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <SummaryCard
        icon={TrendingUp}
        label="Receitas"
        value={formatBRL(income)}
        valueClass="text-success-fg"
        testId="finances-summary-income"
      />
      <SummaryCard
        icon={TrendingDown}
        label="Despesas"
        value={formatBRL(expense)}
        valueClass="text-danger-fg"
        testId="finances-summary-expense"
      />
      <SummaryCard
        icon={Wallet}
        label="Saldo"
        value={formatBRL(balance)}
        valueClass={balanceClass}
        testId="finances-summary-balance"
      />
    </div>
  );
};

export default FinancesSummary;
