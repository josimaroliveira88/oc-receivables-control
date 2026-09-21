import { fromCents, toCents } from '../../../utils/money';

export { originLabel } from '../../Finances/utils/financeHelpers';

export const BILL_STATUS_LABELS = ['Aberta', 'Parcial', 'Paga'];

export const formatBillStatus = (bill) => {
  const transactions = bill?.transactions || [];
  const total = transactions.length || bill?.installments || 0;
  const paid = transactions.filter((transaction) => transaction.isEffective);
  if (total > 0 && paid.length >= total) return 'Paga';
  if (paid.length > 0) return 'Parcial';
  return 'Aberta';
};

export const splitTotalIntoInstallments = (totalCents, installments) => {
  const base = Math.floor(totalCents / installments);
  return Array.from({ length: installments }, (_, index) =>
    index === installments - 1 ? totalCents - base * (installments - 1) : base,
  );
};

export const effectiveDateForInstallment = (firstIso, installmentNumber) => {
  if (!firstIso || !installmentNumber || installmentNumber < 1) return '';
  const [year, month, day] = firstIso.split('T')[0].split('-').map(Number);
  const targetIndex = month - 1 + (installmentNumber - 1);
  const targetYear = year + Math.floor(targetIndex / 12);
  const targetMonth = ((targetIndex % 12) + 12) % 12;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const clampedDay = Math.min(day, lastDay);
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(
    clampedDay,
  ).padStart(2, '0')}`;
};

export const summarizeBills = (bills = [], now = new Date()) => {
  const year = now.getFullYear();
  const month = now.getMonth();
  let totalCents = 0;
  let pendingCents = 0;
  let paidThisMonthCents = 0;

  for (const bill of bills) {
    totalCents += bill.totalCents || 0;
    for (const transaction of bill.transactions || []) {
      const cents = toCents(parseFloat(transaction.amount) || 0);
      if (!transaction.isEffective) {
        pendingCents += cents;
        continue;
      }
      const date = transaction.effectiveDate || transaction.transactionDate;
      if (!date) continue;
      const [txYear, txMonth] = date.split('T')[0].split('-').map(Number);
      if (txYear === year && txMonth - 1 === month) {
        paidThisMonthCents += cents;
      }
    }
  }

  return { totalCents, pendingCents, paidThisMonthCents };
};

export const emptyBillForm = () => ({
  id: null,
  description: '',
  totalAmount: '',
  installments: 1,
  firstInstallmentAt: '',
  brand: '',
  notes: '',
});

export const billToForm = (bill) => ({
  id: bill.id,
  description: bill.description,
  totalAmount: String(fromCents(bill.totalCents)),
  installments: bill.installments,
  firstInstallmentAt: (bill.firstInstallmentAt || '').split('T')[0],
  brand: bill.brand || '',
  notes: bill.notes || '',
});

export const buildBillPayload = (form) => ({
  description: form.description.trim(),
  totalAmount: parseFloat(form.totalAmount) || 0,
  installments: Number(form.installments) || 0,
  firstInstallmentAt: form.firstInstallmentAt,
  brand: form.brand && form.brand.trim() ? form.brand.trim() : null,
  notes: form.notes && form.notes.trim() ? form.notes.trim() : null,
});
