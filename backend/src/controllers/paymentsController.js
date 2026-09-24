import prisma from '../config/database.js';
import { handleError } from '../middlewares/errorResponse.js';
import { notFound } from '../utils/httpError.js';
import { buildOrderBalances } from '../utils/orderBalances.js';
import {
  createPayment as createPaymentService,
  updatePayment as updatePaymentService,
} from '../services/paymentsService.js';
import {
  paymentSchema,
  updatePaymentSchema,
} from '../validators/paymentsValidator.js';

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
      message: 'Pagamento registrado com sucesso',
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
      message: 'Pagamento atualizado com sucesso',
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
      throw notFound('Pedido não encontrado');
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

export { createPayment, updatePayment, getOrderBalance };
