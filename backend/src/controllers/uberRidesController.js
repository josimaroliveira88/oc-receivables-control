import prisma from '../config/database.js';
import { handleError } from '../middlewares/errorResponse.js';
import {
  importRidesSchema,
  createRideExpensesSchema,
  listRidesQuerySchema,
} from '../validators/uberRidesValidator.js';
import {
  listRides,
  importRides,
  createExpensesFromRides,
  deleteRideBatch,
} from '../services/uberRidesService.js';

const listRidesHandler = async (req, res) => {
  try {
    const query = listRidesQuerySchema.parse(req.query);
    const rides = await listRides(prisma, { userId: req.user.userId, query });
    res.status(200).json(rides);
  } catch (error) {
    handleError(res, error, { label: 'Error fetching rides' });
  }
};

const importRidesHandler = async (req, res) => {
  try {
    const payload = importRidesSchema.parse(req.body);
    const summary = await importRides(prisma, {
      userId: req.user.userId,
      source: payload.source ?? 'UBER_ACTIVITY_JSON',
      jsonText: payload.json,
      windowStart: payload.windowStart,
      windowEnd: payload.windowEnd,
    });
    res.status(200).json(summary);
  } catch (error) {
    handleError(res, error, { label: 'Error importing rides' });
  }
};

const createRideExpensesHandler = async (req, res) => {
  try {
    const payload = createRideExpensesSchema.parse(req.body);
    const created = await createExpensesFromRides(prisma, {
      userId: req.user.userId,
      items: payload.items,
    });
    res.status(201).json(created);
  } catch (error) {
    handleError(res, error, { label: 'Error creating ride expenses' });
  }
};

const deleteRideBatchHandler = async (req, res) => {
  try {
    const result = await deleteRideBatch(prisma, {
      userId: req.user.userId,
      batchId: req.params.batchId,
    });
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error, { label: 'Error undoing ride import' });
  }
};

export {
  listRidesHandler,
  importRidesHandler,
  createRideExpensesHandler,
  deleteRideBatchHandler,
};
