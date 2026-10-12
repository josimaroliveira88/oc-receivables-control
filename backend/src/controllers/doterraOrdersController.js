import prisma from '../config/database.js';
import { handleError } from '../middlewares/errorResponse.js';
import {
  lookupSchema,
  importSchema,
  fillAccountOwnerSchema,
} from '../validators/doterraValidator.js';
import {
  lookupOrders,
  importOrders,
  fillAccountOwner,
} from '../services/doterraOrdersService.js';

const lookupOrdersHandler = async (req, res) => {
  try {
    const payload = lookupSchema.parse(req.body);
    const result = await lookupOrders(prisma, {
      userId: req.user.userId,
      numbers: payload.numbers,
    });
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error, { label: 'Error looking up dōTERRA orders' });
  }
};

const importOrdersHandler = async (req, res) => {
  try {
    const payload = importSchema.parse(req.body);
    const summary = await importOrders(prisma, {
      userId: req.user.userId,
      orders: payload.orders,
    });
    res.status(200).json(summary);
  } catch (error) {
    handleError(res, error, { label: 'Error importing dōTERRA orders' });
  }
};

const fillAccountOwnerHandler = async (req, res) => {
  try {
    const payload = fillAccountOwnerSchema.parse(req.body);
    const summary = await fillAccountOwner(prisma, {
      userId: req.user.userId,
      updates: payload.updates,
    });
    res.status(200).json(summary);
  } catch (error) {
    handleError(res, error, {
      label: 'Error filling the dōTERRA account owner',
    });
  }
};

export { lookupOrdersHandler, importOrdersHandler, fillAccountOwnerHandler };
