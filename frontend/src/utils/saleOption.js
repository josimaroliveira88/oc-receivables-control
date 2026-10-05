import { formatBRL, fromCents, toCents } from './money';

// Human label of a sale option for pickers: "V-0001 — João Silva — R$ 100,00".
// The client name and the value are optional; the order number is required.
export const formatSaleOptionLabel = (sale) => {
  if (!sale?.orderNumber) return '';

  const parts = [sale.orderNumber];
  if (sale.clientName) parts.push(sale.clientName);
  if (sale.totalValue !== null && sale.totalValue !== undefined) {
    const cents = toCents(parseFloat(sale.totalValue) || 0);
    parts.push(formatBRL(fromCents(cents)));
  }
  return parts.join(' — ');
};
