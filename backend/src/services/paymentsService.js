// Payment write operations, extracted from the payments controller so the
// handlers stay thin. `client` is a Prisma client; each function owns its own
// `$transaction` (payments are the outermost operation). Business rejections
// are thrown as plain Errors with `.status` (400/404) which the controller
// maps to the HTTP response; R10 replaces these with the shared httpError
// helpers.
const { toCents, lineValueCents } = require('../utils/money');
const { computeOrderStatus } = require('../utils/receivables');
const { parseLocalDate } = require('../utils/date');

const createPayment = async (client, { userId, orderId, payload }) => {
  const amountCents = Math.round(payload.amount * 100);

  return client.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: {
          include: {
            person: true,
          },
        },
        payments: true,
      },
    });

    if (!order) {
      const error = new Error('Order not found');
      error.status = 400;
      throw error;
    }

    if (order.isTeamOrder) {
      const error = new Error(
        'Pedidos da equipe não aceitam pagamentos (a equipe já realizou o pagamento)',
      );
      error.status = 400;
      throw error;
    }

    const person = await tx.person.findFirst({
      where: { id: payload.personId, userId },
    });

    if (!person) {
      const error = new Error('Person not found');
      error.status = 400;
      throw error;
    }

    const itemSumCents = order.items
      .filter((item) => item.personId === payload.personId)
      .reduce((sum, item) => sum + lineValueCents(item), 0);

    if (itemSumCents > 0 && amountCents === 0) {
      const error = new Error(
        'Amount must be greater than zero for a person with chargeable items',
      );
      error.status = 400;
      throw error;
    }

    const payment = await tx.payment.create({
      data: {
        amount: payload.amount,
        orderId: orderId,
        personId: payload.personId,
        paidAt: payload.paidAt ? parseLocalDate(payload.paidAt) : undefined,
        paymentType: payload.paymentType ?? null,
        notes: payload.notes,
      },
    });

    // Recompute the order status considering self persons as already
    // received. The transaction's order.payments read is stale after the
    // create, so the new payment is added explicitly.
    const newStatus = computeOrderStatus({
      items: order.items,
      payments: [
        ...order.payments,
        { personId: payload.personId, amount: payload.amount },
      ],
      shippingCents: toCents(order.shippingValue ?? 0),
    });

    if (newStatus !== order.status) {
      await tx.order.update({
        where: { id: orderId },
        data: { status: newStatus },
      });
    }

    return {
      payment,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: newStatus,
      },
    };
  });
};

const updatePayment = async (client, { id, userId, payload }) => {
  const amountCents = Math.round(payload.amount * 100);

  return client.$transaction(async (tx) => {
    const existingPayment = await tx.payment.findFirst({
      where: { id },
      include: {
        order: true,
      },
    });

    if (!existingPayment || existingPayment.order.userId !== userId) {
      const error = new Error('Payment not found');
      error.status = 404;
      throw error;
    }

    const order = await tx.order.findFirst({
      where: { id: existingPayment.orderId, userId },
      include: {
        items: {
          include: {
            person: true,
          },
        },
        payments: true,
      },
    });

    if (!order) {
      const error = new Error('Payment not found');
      error.status = 404;
      throw error;
    }

    if (order.isTeamOrder) {
      const error = new Error(
        'Pedidos da equipe não aceitam pagamentos (a equipe já realizou o pagamento)',
      );
      error.status = 400;
      throw error;
    }

    const itemSumCents = order.items
      .filter((item) => item.personId === existingPayment.personId)
      .reduce((sum, item) => sum + lineValueCents(item), 0);

    if (itemSumCents > 0 && amountCents === 0) {
      const error = new Error(
        'Amount must be greater than zero for a person with chargeable items',
      );
      error.status = 400;
      throw error;
    }

    const payment = await tx.payment.update({
      where: { id },
      data: {
        amount: payload.amount,
        paidAt: payload.paidAt ? parseLocalDate(payload.paidAt) : undefined,
        paymentType:
          payload.paymentType !== undefined ? payload.paymentType : undefined,
        notes: payload.notes !== undefined ? payload.notes : undefined,
      },
    });

    // Recompute the order status with the edited payment substituted into
    // the transaction snapshot, which is stale after the update.
    const newStatus = computeOrderStatus({
      items: order.items,
      payments: order.payments.map((p) =>
        p.id === id ? { personId: p.personId, amount: payment.amount } : p,
      ),
      shippingCents: toCents(order.shippingValue ?? 0),
    });

    if (newStatus !== order.status) {
      await tx.order.update({
        where: { id: order.id },
        data: { status: newStatus },
      });
    }

    return {
      payment,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: newStatus,
      },
    };
  });
};

module.exports = { createPayment, updatePayment };
