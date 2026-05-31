const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const prisma = new PrismaClient();
const { toCents, fromCents } = require('../utils/money');

const paymentSchema = z.object({
  amount: z.number().positive('Amount must be greater than zero'),
  personId: z.string().uuid('Person ID must be a valid UUID'),
  notes: z.string().optional(),
});

const createPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const validatedData = paymentSchema.parse(req.body);

    const amountCents = Math.round(validatedData.amount * 100);

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
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

      const person = await tx.person.findUnique({
        where: { id: validatedData.personId },
      });

      if (!person) {
        throw new Error('Person not found');
      }

      const itemSumCents = order.items
        .filter(item => item.personId === validatedData.personId)
        .reduce((sum, item) => sum + toCents(item.value), 0);

      const paymentSumCents = order.payments
        .filter(payment => payment.personId === validatedData.personId)
        .reduce((sum, payment) => sum + toCents(payment.amount), 0);

      const pendingCents = itemSumCents - paymentSumCents;

      if (amountCents <= 0) {
        throw new Error('Amount must be greater than zero');
      }

      if (amountCents > pendingCents) {
        throw new Error('Amount exceeds pending balance');
      }

      const payment = await tx.payment.create({
        data: {
          amount: validatedData.amount,
          orderId: orderId,
          personId: validatedData.personId,
          notes: validatedData.notes,
        },
      });

      const personIds = [...new Set(order.items.map(item => item.personId))];

      let allPaid = true;
      let hasAnyPayment = false;

      for (const pid of personIds) {
        if (!pid) continue;

        const personItemSumCents = order.items
          .filter(item => item.personId === pid)
          .reduce((sum, item) => sum + toCents(item.value), 0);

        let personPaymentSumCents = order.payments
          .filter(payment => payment.personId === pid)
          .reduce((sum, payment) => sum + toCents(payment.amount), 0);

        if (pid === validatedData.personId) {
          personPaymentSumCents += amountCents;
        }

        const personPendingCents = personItemSumCents - personPaymentSumCents;

        if (personPendingCents > 0) {
          allPaid = false;
        }

        if (personPaymentSumCents > 0) {
          hasAnyPayment = true;
        }
      }

      let newStatus;
      if (allPaid) {
        newStatus = 'QUITADO';
      } else if (hasAnyPayment) {
        newStatus = 'PARCIAL';
      } else {
        newStatus = 'PENDENTE';
      }

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

    const order = await prisma.order.findUnique({
      where: { id: orderId },
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

    order.items.forEach(item => {
      const personId = item.personId;
      if (!personId) return;

      if (!personMap.has(personId)) {
        const person = item.person;
        personMap.set(personId, {
          personId,
          personName: person ? person.name : 'Unknown',
          itemTotalCents: 0,
          paymentTotalCents: 0,
        });
      }

      const current = personMap.get(personId);
      personMap.set(personId, {
        ...current,
        itemTotalCents: current.itemTotalCents + toCents(item.value),
      });
    });

    order.payments.forEach(payment => {
      const personId = payment.personId;
      if (!personId) return;

      if (!personMap.has(personId)) {
        const person = payment.person;
        personMap.set(personId, {
          personId,
          personName: person ? person.name : 'Unknown',
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

    const balances = Array.from(personMap.values()).map(personData => {
      const pendingCents = personData.itemTotalCents - personData.paymentTotalCents;
      return {
        personId: personData.personId,
        personName: personData.personName,
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
