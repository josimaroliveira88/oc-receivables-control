import { formatBRL } from '../../../utils/money';

export const brlTooltipFormatter = (value) => formatBRL(value);

export const brlTickFormatter = (value) => {
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}k`;
  }
  return `R$ ${value}`;
};

export const hasDashboardData = (data) =>
  !!data &&
  ((data.personBalances && data.personBalances.length > 0) ||
    data.totalPending > 0 ||
    data.totalPaid > 0 ||
    data.currentMonthReceipts > 0);

export const buildChartData = (personBalances) =>
  (personBalances || []).map((p) => ({
    name: p.isSelf ? `${p.personName} (Você)` : p.personName,
    Itens: p.itemTotal,
    Pagamentos: p.paymentTotal,
  }));
