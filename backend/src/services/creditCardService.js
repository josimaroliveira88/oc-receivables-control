import { fromCents, toCents } from '../utils/money.js';
import { getDefaultCategoryName } from '../utils/financeDefaults.js';

const addMonthsClamped = (date, months) => {
  const targetMonth = date.getUTCMonth() + months;
  const year = date.getUTCFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(date.getUTCDate(), lastDayOfMonth);
  return new Date(Date.UTC(year, month, day));
};

const splitTotalIntoInstallments = (totalCents, installments) => {
  const base = Math.floor(totalCents / installments);
  const amounts = Array.from({ length: installments }, () => base);
  amounts[installments - 1] = totalCents - base * (installments - 1);
  return amounts;
};

const resolveCreditCardCategoryId = async (client, userId) => {
  const name = getDefaultCategoryName('CARTAO_CREDITO');
  if (!name) return null;

  const category = await client.financialCategory.findFirst({
    where: { userId, name },
  });

  return category?.id ?? null;
};

const createInstallments = async (
  client,
  {
    userId,
    order,
    bill,
    totalCents,
    installments,
    firstInstallmentAt,
    categoryId,
  },
) => {
  const amounts = splitTotalIntoInstallments(totalCents, installments);

  await client.financialTransaction.createMany({
    data: amounts.map((amountCents, index) => {
      const effectiveDate = addMonthsClamped(firstInstallmentAt, index);
      return {
        userId,
        type: 'DESPESA',
        origin: 'PEDIDO_DOTERRA',
        amount: fromCents(amountCents).toFixed(2),
        description: `Pedido dōTERRA ${order.orderNumber}`,
        transactionDate: effectiveDate,
        isEffective: false,
        effectiveDate,
        installmentNumber: index + 1,
        installmentsTotal: installments,
        paymentType: 'CARTAO_CREDITO',
        categoryId,
        orderId: order.id,
        creditCardBillId: bill.id,
      };
    }),
  });
};

const upsertBillForOrder = async (client, { userId, order }) => {
  const installments = order.installments ?? 1;
  const firstInstallmentAt = order.firstInstallmentAt ?? order.orderDate;
  const totalCents = toCents(order.doterraValue ?? order.totalValue);
  const categoryId = await resolveCreditCardCategoryId(client, userId);

  const existing = await client.creditCardBill.findUnique({
    where: { orderId: order.id },
  });

  const billData = {
    userId,
    description: `Pedido dōTERRA ${order.orderNumber}`,
    totalCents,
    installments,
    firstInstallmentAt,
    categoryId,
    paymentType: 'CARTAO_CREDITO',
  };

  if (existing) {
    const effectiveCount = await client.financialTransaction.count({
      where: { creditCardBillId: existing.id, isEffective: true },
    });
    const bill = await client.creditCardBill.update({
      where: { id: existing.id },
      data: billData,
    });

    if (effectiveCount === 0) {
      await client.financialTransaction.deleteMany({
        where: { creditCardBillId: existing.id },
      });
      await createInstallments(client, {
        userId,
        order,
        bill,
        totalCents,
        installments,
        firstInstallmentAt,
        categoryId,
      });
    }

    return bill;
  }

  const bill = await client.creditCardBill.create({
    data: { ...billData, orderId: order.id },
  });
  await createInstallments(client, {
    userId,
    order,
    bill,
    totalCents,
    installments,
    firstInstallmentAt,
    categoryId,
  });

  return bill;
};

const removeBillForOrder = (client, { userId, orderId }) =>
  client.creditCardBill.deleteMany({ where: { orderId, userId } });

export {
  addMonthsClamped,
  splitTotalIntoInstallments,
  upsertBillForOrder,
  removeBillForOrder,
};
