import { toCents, fromCents, lineValueCents } from './money.js';
import { personPendingCents } from './receivables.js';

// Projects a person's accumulated cents into the balance shape shared by the
// order-balance endpoint and the dashboard. Self persons always have a
// pending of 0; any other negative balance is clamped to 0 (overpayment).
const personBalanceFromTotals = ({
  personId,
  personName,
  isSelf,
  itemTotalCents,
  paymentTotalCents,
}) => {
  const pendingCents = personPendingCents({
    itemCents: itemTotalCents,
    paymentCents: paymentTotalCents,
    isSelf,
  });
  return {
    personId,
    personName,
    isSelf,
    itemTotal: fromCents(itemTotalCents),
    paymentTotal: fromCents(paymentTotalCents),
    pending: fromCents(Math.max(0, pendingCents)),
  };
};

// Builds the per-person balances of a single order. Items without a personId
// are ignored; entries are sorted by person name.
const buildOrderBalances = (order) => {
  const personMap = new Map();

  order.items.forEach((item) => {
    const personId = item.personId;
    if (!personId) return;

    if (!personMap.has(personId)) {
      const person = item.person;
      personMap.set(personId, {
        personId,
        personName: person ? person.name : 'Unknown',
        isSelf: Boolean(person && person.isSelf),
        itemTotalCents: 0,
        paymentTotalCents: 0,
      });
    }

    const current = personMap.get(personId);
    personMap.set(personId, {
      ...current,
      itemTotalCents: current.itemTotalCents + lineValueCents(item),
    });
  });

  order.payments.forEach((payment) => {
    const personId = payment.personId;
    if (!personId) return;

    if (!personMap.has(personId)) {
      const person = payment.person;
      personMap.set(personId, {
        personId,
        personName: person ? person.name : 'Unknown',
        isSelf: Boolean(person && person.isSelf),
        itemTotalCents: 0,
        paymentTotalCents: 0,
      });
    }

    const current = personMap.get(personId);
    personMap.set(personId, {
      ...current,
      paymentTotalCents: current.paymentTotalCents + toCents(payment.amount),
    });
  });

  return Array.from(personMap.values())
    .map(personBalanceFromTotals)
    .sort((a, b) => a.personName.localeCompare(b.personName));
};

export { personBalanceFromTotals, buildOrderBalances };
