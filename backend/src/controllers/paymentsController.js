const prisma = require('../config/database');
const { handleError } = require('../middlewares/errorResponse');
const { notFound } = require('../utils/httpError');
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
    handleError(res, error, { label: 'Error creating payment', fallback: 400 });
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
    handleError(res, error, { label: 'Error updating payment', fallback: 400 });
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
      throw notFound('Order not found');
    }

    const balances = buildOrderBalances(order);

    res.status(200).json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      balances,
    });
  } catch (error) {
    handleError(res, error, { label: 'Error fetching order balance' });
  }
};

module.exports = {
  createPayment,
  updatePayment,
  getOrderBalance,
};
