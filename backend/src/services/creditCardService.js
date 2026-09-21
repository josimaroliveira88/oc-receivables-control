import { fromCents, toCents } from '../utils/money.js';
import { getDefaultCategoryName } from '../utils/financeDefaults.js';
import { parseLocalDate } from '../utils/date.js';
import { badRequest, conflict, notFound } from '../utils/httpError.js';
import { assertCategoryMatches } from '../utils/financeCategory.js';

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

const findOwnedBill = async (client, userId, id) => {
  const bill = await client.creditCardBill.findFirst({ where: { id, userId } });
  if (!bill) {
    throw notFound('Credit card bill not found');
  }
  return bill;
};

const findPaidInstallments = (client, billId) =>
  client.financialTransaction.findMany({
    where: { creditCardBillId: billId, isEffective: true },
    select: { id: true },
    orderBy: { installmentNumber: 'asc' },
  });

const assertEditable = async (client, billId) => {
  const paid = await findPaidInstallments(client, billId);
  if (paid.length > 0) {
    const error = conflict('Cannot change a bill with effective installments');
    error.paidInstallmentIds = paid.map((row) => row.id);
    throw error;
  }
};

const createInstallmentRows = (
  client,
  { userId, bill, totalCents, installments, firstInstallmentAt, categoryId },
) => {
  const amounts = splitTotalIntoInstallments(totalCents, installments);

  return client.financialTransaction.createMany({
    data: amounts.map((amountCents, index) => {
      const effectiveDate = addMonthsClamped(firstInstallmentAt, index);
      return {
        userId,
        type: 'DESPESA',
        origin: 'CARTAO_CREDITO',
        amount: fromCents(amountCents).toFixed(2),
        description: bill.description,
        transactionDate: effectiveDate,
        isEffective: false,
        effectiveDate,
        installmentNumber: index + 1,
        installmentsTotal: installments,
        paymentType: bill.paymentType,
        categoryId,
        creditCardBillId: bill.id,
      };
    }),
  });
};

const billInclude = {
  category: true,
  transactions: { orderBy: { installmentNumber: 'asc' } },
};

const listBills = async (client, userId) =>
  client.creditCardBill.findMany({
    where: { userId },
    include: billInclude,
    orderBy: [{ firstInstallmentAt: 'desc' }, { createdAt: 'desc' }],
  });

const getBill = async (client, userId, id) => {
  const bill = await client.creditCardBill.findFirst({
    where: { id, userId },
    include: billInclude,
  });
  if (!bill) {
    throw notFound('Credit card bill not found');
  }
  return bill;
};

const createManualBill = async (client, { userId, payload }) => {
  await assertCategoryMatches(client, userId, {
    categoryId: payload.categoryId,
    type: 'DESPESA',
  });

  const totalCents = toCents(payload.totalAmount);
  if (totalCents <= 0) {
    throw badRequest('Amount must be greater than zero');
  }

  const firstInstallmentAt = parseLocalDate(payload.firstInstallmentAt);

  return client.$transaction(async (tx) => {
    const bill = await tx.creditCardBill.create({
      data: {
        userId,
        description: payload.description,
        totalCents,
        installments: payload.installments,
        firstInstallmentAt,
        brand: payload.brand ?? null,
        notes: payload.notes ?? null,
        categoryId: payload.categoryId ?? null,
        paymentType: 'CARTAO_CREDITO',
      },
    });

    await createInstallmentRows(tx, {
      userId,
      bill,
      totalCents,
      installments: payload.installments,
      firstInstallmentAt,
      categoryId: payload.categoryId ?? null,
    });

    return tx.creditCardBill.findUnique({
      where: { id: bill.id },
      include: billInclude,
    });
  });
};

const updateBill = async (client, { userId, id, payload }) => {
  const existing = await findOwnedBill(client, userId, id);
  await assertCategoryMatches(client, userId, {
    categoryId: payload.categoryId,
    type: 'DESPESA',
  });

  const installments = payload.installments ?? existing.installments;
  const firstInstallmentAt = payload.firstInstallmentAt
    ? parseLocalDate(payload.firstInstallmentAt)
    : existing.firstInstallmentAt;
  const totalCents =
    payload.totalAmount !== undefined
      ? toCents(payload.totalAmount)
      : existing.totalCents;
  const categoryId =
    payload.categoryId !== undefined ? payload.categoryId : existing.categoryId;

  const regenerates =
    (payload.installments !== undefined &&
      payload.installments !== existing.installments) ||
    (payload.firstInstallmentAt !== undefined &&
      firstInstallmentAt.getTime() !== existing.firstInstallmentAt.getTime()) ||
    (payload.totalAmount !== undefined && totalCents !== existing.totalCents) ||
    (payload.categoryId !== undefined && categoryId !== existing.categoryId);

  if (regenerates) {
    await assertEditable(client, existing.id);
  }

  return client.$transaction(async (tx) => {
    const bill = await tx.creditCardBill.update({
      where: { id },
      data: {
        ...(payload.description !== undefined && {
          description: payload.description,
        }),
        totalCents,
        installments,
        firstInstallmentAt,
        ...(payload.brand !== undefined && { brand: payload.brand }),
        ...(payload.notes !== undefined && { notes: payload.notes }),
        categoryId,
      },
    });

    if (regenerates) {
      await tx.financialTransaction.deleteMany({
        where: { creditCardBillId: id },
      });
      await createInstallmentRows(tx, {
        userId,
        bill,
        totalCents,
        installments,
        firstInstallmentAt,
        categoryId,
      });
    }

    return tx.creditCardBill.findUnique({
      where: { id },
      include: billInclude,
    });
  });
};

const deleteBill = async (client, { userId, id }) => {
  const existing = await findOwnedBill(client, userId, id);
  await assertEditable(client, existing.id);

  await client.creditCardBill.delete({ where: { id } });
};

const findOwnedInstallment = async (client, userId, id) => {
  const installment = await client.financialTransaction.findFirst({
    where: { id, userId, creditCardBillId: { not: null } },
  });
  if (!installment) {
    throw notFound('Installment not found');
  }
  return installment;
};

const payInstallment = async (client, { userId, id, paidAt }) => {
  const installment = await findOwnedInstallment(client, userId, id);
  const effectiveDate = parseLocalDate(paidAt);

  if (
    installment.isEffective &&
    installment.effectiveDate &&
    installment.effectiveDate.getTime() === effectiveDate.getTime()
  ) {
    return installment;
  }

  return client.financialTransaction.update({
    where: { id },
    data: { isEffective: true, effectiveDate },
  });
};

const unpayInstallment = async (client, { userId, id }) => {
  const installment = await findOwnedInstallment(client, userId, id);

  if (!installment.isEffective) {
    return installment;
  }

  return client.financialTransaction.update({
    where: { id },
    data: { isEffective: false, effectiveDate: null },
  });
};

export {
  addMonthsClamped,
  splitTotalIntoInstallments,
  upsertBillForOrder,
  removeBillForOrder,
  listBills,
  getBill,
  createManualBill,
  updateBill,
  deleteBill,
  payInstallment,
  unpayInstallment,
};
