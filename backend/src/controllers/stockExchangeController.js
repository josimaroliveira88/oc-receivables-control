import prisma from '../config/database.js';
import { handleError } from '../middlewares/errorResponse.js';
import { createStockExchangeSchema } from '../validators/stockExchangeValidator.js';
import * as stockExchangeService from '../services/stockExchangeService.js';

const createStockExchange = async (req, res) => {
  try {
    const payload = createStockExchangeSchema.parse(req.body);
    const result = await prisma.$transaction(async (tx) =>
      stockExchangeService.createStockExchange(tx, {
        userId: req.user.userId,
        personId: payload.personId,
        effectiveDate: payload.effectiveDate,
        observation: payload.observation ?? null,
        outgoingLines: payload.outgoingLines,
        incomingLines: payload.incomingLines,
      }),
    );
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, { label: 'Create stock exchange', fallback: 400 });
  }
};

const getStockExchange = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await prisma.$transaction(async (tx) =>
      stockExchangeService.getStockExchange(tx, {
        id,
        userId: req.user.userId,
      }),
    );
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error, { label: 'Get stock exchange', fallback: 400 });
  }
};

export { createStockExchange, getStockExchange };
