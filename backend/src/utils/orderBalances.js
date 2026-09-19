import { toCents, fromCents, lineValueCents } from './money.js';
import { personPendingCents } from './receivables.js';

// Projects a person's accumulated cents into the balance shape shared by the
// order-balance endpoint and person summaries. Self persons always have a
// pending of 0; any other negative balance is clamped to 0 (overpayment).
// `extraCents` are order-level charges assignable to this person (currently
// only for sales) that count toward pending but never toward itemTotal.
const personBalanceFromTotals = ({
  personId,
  personName,
  isSelf,
  itemTotalCents,
  paymentTotalCents,
  extraCents = 0,
}) => {
  const pendingCents = personPendingCents({
    itemCents: itemTotalCents + extraCents,
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

// Sales (VENDA) always have a non-self client, so the order-level shipping and
// additional charges are collectable from that client. This spreads those
// charges across the non-self persons (in practice a single client) so each
// person's pending includes them. Purchase orders keep their previous behavior
// (charges live in totalValue and, for legacy orders, prorated item values).
const saleChargesByPerson = (order, personMap) => {
  const charges = new Map();
  if (order.orderType !== 'VENDA') return charges;

  const chargeCents =
    toCents(order.shippingValue ?? 0) + toCents(order.additionalValue ?? 0);
  if (chargeCents === 0) return charges;

  const entries = Array.from(personMap.values()).filter((p) => !p.isSelf);
  if (entries.length === 0) return charges;

  const totalItemCents = entries.reduce((sum, e) => sum + e.itemTotalCents, 0);
  let remaining = chargeCents;

  entries.forEach((entry, index) => {
    const isLast = index === entries.length - 1;
    const share = isLast
      ? remaining
      : totalItemCents > 0
        ? Math.round((chargeCents * entry.itemTotalCents) / totalItemCents)
        : Math.floor(chargeCents / entries.length);
    charges.set(entry.personId, share);
    remaining -= share;
  });

  return charges;
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

  const saleCharges = saleChargesByPerson(order, personMap);

  return Array.from(personMap.values())
    .map((entry) =>
      personBalanceFromTotals({
        ...entry,
        extraCents: saleCharges.get(entry.personId) || 0,
      }),
    )
    .sort((a, b) => a.personName.localeCompare(b.personName));
};

export { personBalanceFromTotals, buildOrderBalances };
