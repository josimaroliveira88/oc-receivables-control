const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const prisma = new PrismaClient();
const { toCents, fromCents, lineValueCents } = require('../utils/money');
const { computeOrderStatus } = require('../utils/receivables');

const parseLocalDate = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const paymentSchema = z.object({
  amount: z
    .number()
    .nonnegative('Amount must be greater than or equal to zero'),
  personId: z.string().uuid('Person ID must be a valid UUID'),
  paidAt: z.string().optional(),
  notes: z.string().optional(),
});

const createPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const validatedData = paymentSchema.parse(req.body);

    const amountCents = Math.round(validatedData.amount * 100);

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, userId: req.user.userId },
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
        throw new Error('Order not found');
      }

      const person = await tx.person.findFirst({
        where: { id: validatedData.personId, userId: req.user.userId },
      });

      if (!person) {
        throw new Error('Person not found');
      }

      const itemSumCents = order.items
        .filter((item) => item.personId === validatedData.personId)
        .reduce((sum, item) => sum + lineValueCents(item), 0);

      if (itemSumCents > 0 && amountCents === 0) {
        throw new Error(
          'Amount must be greater than zero for a person with chargeable items',
        );
      }

      const payment = await tx.payment.create({
        data: {
          amount: validatedData.amount,
          orderId: orderId,
          personId: validatedData.personId,
          paidAt: validatedData.paidAt
            ? parseLocalDate(validatedData.paidAt)
            : undefined,
          notes: validatedData.notes,
        },
      });

      // Recompute the order status considering self persons as already
      // received. The transaction's order.payments read is stale after the
      // create, so the new payment is added explicitly.
      const newStatus = computeOrderStatus({
        items: order.items,
        payments: [
          ...order.payments,
          { personId: validatedData.personId, amount: validatedData.amount },
        ],
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

    res.status(201).json({
      message: 'Payment created successfully',
      payment: result.payment,
      order: result.order,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error creating payment:', error);
    res.status(400).json({ error: error.message });
  }
};

const getOrderBalance = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: req.user.userId },
      include: {
        items: {
          include: {
            person: true,
          },
        },
        payments: {
          include: {
            person: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

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

    const balances = Array.from(personMap.values()).map((personData) => {
      const pendingCents = personData.isSelf
        ? 0
        : personData.itemTotalCents - personData.paymentTotalCents;
      return {
        personId: personData.personId,
        personName: personData.personName,
        isSelf: personData.isSelf,
        itemTotal: fromCents(personData.itemTotalCents),
        paymentTotal: fromCents(personData.paymentTotalCents),
        pending: fromCents(Math.max(0, pendingCents)),
      };
    });

    balances.sort((a, b) => a.personName.localeCompare(b.personName));

    res.status(200).json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      balances,
    });
  } catch (error) {
    console.error('Error fetching order balance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createPayment,
  getOrderBalance,
};
