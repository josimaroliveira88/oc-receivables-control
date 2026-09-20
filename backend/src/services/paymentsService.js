// Payment write operations, extracted from the payments controller so the
// handlers stay thin. `client` is a Prisma client; each function owns its own
// `$transaction` (payments are the outermost operation). Business rejections
// are thrown as HTTP-mapped errors (via utils/httpError.js) which the
// controller maps to the HTTP response.
import { toCents, fromCents, lineValueCents } from '../utils/money.js';
import {
  computeOrderStatus,
  chargeableAdditionalCents,
} from '../utils/receivables.js';
import { paymentFeeCents } from '../utils/paymentFee.js';
import { parseLocalDate } from '../utils/date.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { syncIncomeFromPayment } from './financeSyncService.js';

const TEAM_ORDER_MESSAGE =
  'Pedidos da equipe não aceitam pagamentos (a equipe já realizou o pagamento)';

// Adds the derived gateway fee to a payment returned to the client. The fee is
// never persisted: it is always `amount - netAmount` (0 when no net informed).
const withFeeAmount = (payment) => ({
  ...payment,
  feeAmount: fromCents(paymentFeeCents(payment)).toFixed(2),
});

// Rejects a net amount greater than the charged amount (the fee cannot be
// negative). No-op when no net amount was informed.
const assertValidNetAmount = ({ amountCents, netAmount }) => {
  if (netAmount === null || netAmount === undefined) return;
  if (Math.round(netAmount * 100) > amountCents) {
    throw badRequest('Net amount cannot be greater than the charged amount');
  }
};

const createPayment = async (client, { userId, orderId, payload }) => {
  const amountCents = Math.round(payload.amount * 100);
  assertValidNetAmount({ amountCents, netAmount: payload.netAmount });

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
      throw badRequest('Order not found');
    }

    if (order.isTeamOrder) {
      throw badRequest(TEAM_ORDER_MESSAGE);
    }

    const person = await tx.person.findFirst({
      where: { id: payload.personId, userId },
    });

    if (!person) {
      throw badRequest('Person not found');
    }

    const itemSumCents = order.items
      .filter((item) => item.personId === payload.personId)
      .reduce((sum, item) => sum + lineValueCents(item), 0);

    if (itemSumCents > 0 && amountCents === 0) {
      throw badRequest(
        'Amount must be greater than zero for a person with chargeable items',
      );
    }

    const payment = await tx.payment.create({
      data: {
        amount: payload.amount,
        netAmount: payload.netAmount ?? null,
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
      additionalCents: chargeableAdditionalCents(order),
    });

    const orderData = {};
    if (newStatus !== order.status) orderData.status = newStatus;
    // The fee-passthrough flag lives on the order (a sale-level setting), so it
    // is persisted here when the payment form sends it.
    if (payload.passesGatewayFeeToClient !== undefined) {
      orderData.passesGatewayFeeToClient = payload.passesGatewayFeeToClient;
    }
    if (Object.keys(orderData).length > 0) {
      await tx.order.update({ where: { id: orderId }, data: orderData });
    }

    // Mirror the payment into the financial ledger (income) inside the same
    // transaction. No-op for dōTERRA orders, team orders and InfinitePay.
    await syncIncomeFromPayment(tx, { userId, payment, order });

    return {
      payment: withFeeAmount(payment),
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: newStatus,
        passesGatewayFeeToClient:
          payload.passesGatewayFeeToClient ?? order.passesGatewayFeeToClient,
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
      throw notFound('Payment not found');
    }

    const effectiveNetAmount =
      payload.netAmount !== undefined
        ? payload.netAmount
        : existingPayment.netAmount;
    assertValidNetAmount({ amountCents, netAmount: effectiveNetAmount });

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
      throw notFound('Payment not found');
    }

    if (order.isTeamOrder) {
      throw badRequest(TEAM_ORDER_MESSAGE);
    }

    const itemSumCents = order.items
      .filter((item) => item.personId === existingPayment.personId)
      .reduce((sum, item) => sum + lineValueCents(item), 0);

    if (itemSumCents > 0 && amountCents === 0) {
      throw badRequest(
        'Amount must be greater than zero for a person with chargeable items',
      );
    }

    const payment = await tx.payment.update({
      where: { id },
      data: {
        amount: payload.amount,
        netAmount:
          payload.netAmount !== undefined ? payload.netAmount : undefined,
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
      additionalCents: chargeableAdditionalCents(order),
    });

    const orderData = {};
    if (newStatus !== order.status) orderData.status = newStatus;
    if (payload.passesGatewayFeeToClient !== undefined) {
      orderData.passesGatewayFeeToClient = payload.passesGatewayFeeToClient;
    }
    if (Object.keys(orderData).length > 0) {
      await tx.order.update({ where: { id: order.id }, data: orderData });
    }

    // Re-sync the ledger row for this payment (updates amount/date, or removes
    // it when the payment becomes InfinitePay) inside the same transaction.
    await syncIncomeFromPayment(tx, { userId, payment, order });

    return {
      payment: withFeeAmount(payment),
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: newStatus,
        passesGatewayFeeToClient:
          payload.passesGatewayFeeToClient ?? order.passesGatewayFeeToClient,
      },
    };
  });
};

export { createPayment, updatePayment };
