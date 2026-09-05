const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const prisma = new PrismaClient();
const { buildOrderBalances } = require('../utils/orderBalances');
const {
  createPayment: createPaymentService,
  updatePayment: updatePaymentService,
} = require('../services/paymentsService');
const {
  paymentSchema,
  updatePaymentSchema,
} = require('../validators/paymentsValidator');

const createPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const validatedData = paymentSchema.parse(req.body);

    const result = await createPaymentService(prisma, {
      userId: req.user.userId,
      orderId,
      payload: validatedData,
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
    res.status(error.status || 400).json({ error: error.message });
  }
};

const updatePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updatePaymentSchema.parse(req.body);

    const result = await updatePaymentService(prisma, {
      id,
      userId: req.user.userId,
      payload: validatedData,
    });

    res.status(200).json({
      message: 'Payment updated successfully',
      payment: result.payment,
      order: result.order,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Error updating payment:', error);
    res.status(error.status || 400).json({ error: error.message });
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

    const balances = buildOrderBalances(order);

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
  updatePayment,
  getOrderBalance,
};
