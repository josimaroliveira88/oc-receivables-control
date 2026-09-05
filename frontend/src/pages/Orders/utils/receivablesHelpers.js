import { toCents } from '../../../utils/money';
import { lineValueCents } from './orderHelpers';

export const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const toLocalDateInput = (iso) => {
  if (!iso) return getTodayString();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return getTodayString();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getSelectedBalance = (balances, selectedPersonId) =>
  balances.find((b) => b.personId === selectedPersonId) || null;

export const getSelectedPendingCents = (balances, selectedPersonId) => {
  const balance = getSelectedBalance(balances, selectedPersonId);
  return balance ? toCents(balance.pending) : 0;
};

export const isSelectedZeroItem = (balances, selectedPersonId) => {
  const balance = getSelectedBalance(balances, selectedPersonId);
  return !!balance && toCents(balance.itemTotal) === 0;
};

export const getOrderPaidCents = (order) => {
  if (!order) return 0;
  return (order.payments || []).reduce(
    (sum, p) => sum + toCents(parseFloat(p.amount)),
    0,
  );
};

export const getOrderSelfCents = (order) => {
  if (!order) return 0;
  return (order.items || [])
    .filter((item) => item.person && item.person.isSelf)
    .reduce((sum, item) => sum + lineValueCents(item), 0);
};

// The order shipping (frete) is the user's own cost when no item is bound to
// another person: current-version orders are all-self, and legacy orders that
// linked people to items keep the frete collectable (it was prorated into
// their item values at creation time).
export const getOrderSelfShippingCents = (order) => {
  if (!order || order.isTeamOrder) return 0;
  const hasOtherPersonItems = (order.items || []).some(
    (item) => item.person && !item.person.isSelf,
  );
  if (hasOtherPersonItems) return 0;
  return toCents(parseFloat(order.shippingValue ?? 0));
};

export const getOrderPendingCents = (order) => {
  if (!order || order.isTeamOrder) return 0;
  return Math.max(
    0,
    toCents(parseFloat(order.totalValue)) -
      getOrderSelfCents(order) -
      getOrderSelfShippingCents(order) -
      getOrderPaidCents(order),
  );
};

export const getPersonItems = (order, personId) => {
  if (!order) return [];
  return (order.items || []).filter((item) => item.personId === personId);
};

export const getPersonPayments = (order, personId) => {
  if (!order) return [];
  return (order.payments || []).filter(
    (payment) => payment.personId === personId,
  );
};

export const getOrderFinancials = (order) => {
  const totalCents = toCents(parseFloat(order.totalValue));
  const paidCents = getOrderPaidCents(order);
  const selfCents = getOrderSelfCents(order);
  const pendingCents = order.isTeamOrder
    ? 0
    : Math.max(
        0,
        totalCents - selfCents - getOrderSelfShippingCents(order) - paidCents,
      );
  return { totalCents, paidCents, selfCents, pendingCents };
};

export const shouldShowPaymentAction = (order) => {
  if (order.isTeamOrder) return false;
  const { totalCents, pendingCents } = getOrderFinancials(order);
  return pendingCents > 0 || (totalCents === 0 && order.status !== 'QUITADO');
};

export const getPaymentActionLabel = (order) =>
  toCents(parseFloat(order.totalValue)) === 0
    ? 'Dar baixa'
    : 'Registrar Pagamento';

export const paymentPayload = ({
  paymentAmount,
  selectedPersonId,
  paymentDate,
  paymentNotes,
  paymentType,
}) => {
  const payload = {
    amount: parseFloat(paymentAmount || '0'),
    personId: selectedPersonId,
    paidAt: paymentDate || undefined,
    notes: paymentNotes.trim() || undefined,
  };
  if (paymentType) payload.paymentType = paymentType;
  return payload;
};

export const editPaymentPayload = ({
  paymentAmount,
  paymentDate,
  paymentNotes,
  paymentType,
}) => {
  const payload = {
    amount: parseFloat(paymentAmount || '0'),
    paidAt: paymentDate || undefined,
    notes: paymentNotes.trim() || null,
  };
  if (paymentType !== undefined) payload.paymentType = paymentType || null;
  return payload;
};
