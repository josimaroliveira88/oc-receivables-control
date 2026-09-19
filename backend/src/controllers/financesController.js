import prisma from '../config/database.js';
import { handleError } from '../middlewares/errorResponse.js';
import {
  createCategorySchema,
  updateCategorySchema,
  createTransactionSchema,
  updateTransactionSchema,
  listTransactionsQuerySchema,
} from '../validators/financesValidator.js';
import {
  listCategories,
  createCategory,
  updateCategory,
  deactivateCategory,
} from '../services/financeCategoriesService.js';
import {
  listTransactions,
  createManualTransaction,
  updateManualTransaction,
  deleteManualTransaction,
  getSummary,
} from '../services/financeTransactionsService.js';

const getCategories = async (req, res) => {
  try {
    const categories = await listCategories(prisma, req.user.userId);
    res.status(200).json(categories);
  } catch (error) {
    handleError(res, error, { label: 'Error fetching finance categories' });
  }
};

const createCategoryHandler = async (req, res) => {
  try {
    const payload = createCategorySchema.parse(req.body);
    const category = await createCategory(prisma, req.user.userId, payload);
    res.status(201).json(category);
  } catch (error) {
    handleError(res, error, { label: 'Error creating finance category' });
  }
};

const updateCategoryHandler = async (req, res) => {
  try {
    const payload = updateCategorySchema.parse(req.body);
    const category = await updateCategory(
      prisma,
      req.user.userId,
      req.params.id,
      payload,
    );
    res.status(200).json(category);
  } catch (error) {
    handleError(res, error, { label: 'Error updating finance category' });
  }
};

const deleteCategoryHandler = async (req, res) => {
  try {
    await deactivateCategory(prisma, req.user.userId, req.params.id);
    res
      .status(200)
      .json({ message: 'Finance category deactivated successfully' });
  } catch (error) {
    handleError(res, error, { label: 'Error deactivating finance category' });
  }
};

const getTransactions = async (req, res) => {
  try {
    const query = listTransactionsQuerySchema.parse(req.query);
    const transactions = await listTransactions(prisma, {
      userId: req.user.userId,
      query,
    });
    res.status(200).json(transactions);
  } catch (error) {
    handleError(res, error, { label: 'Error fetching finance transactions' });
  }
};

const createTransactionHandler = async (req, res) => {
  try {
    const payload = createTransactionSchema.parse(req.body);
    const transaction = await createManualTransaction(prisma, {
      userId: req.user.userId,
      payload,
    });
    res.status(201).json(transaction);
  } catch (error) {
    handleError(res, error, { label: 'Error creating finance transaction' });
  }
};

const updateTransactionHandler = async (req, res) => {
  try {
    const payload = updateTransactionSchema.parse(req.body);
    const transaction = await updateManualTransaction(prisma, {
      userId: req.user.userId,
      id: req.params.id,
      payload,
    });
    res.status(200).json(transaction);
  } catch (error) {
    handleError(res, error, { label: 'Error updating finance transaction' });
  }
};

const deleteTransactionHandler = async (req, res) => {
  try {
    await deleteManualTransaction(prisma, {
      userId: req.user.userId,
      id: req.params.id,
    });
    res
      .status(200)
      .json({ message: 'Finance transaction deleted successfully' });
  } catch (error) {
    handleError(res, error, { label: 'Error deleting finance transaction' });
  }
};

const getSummaryHandler = async (req, res) => {
  try {
    const query = listTransactionsQuerySchema.parse(req.query);
    const summary = await getSummary(prisma, {
      userId: req.user.userId,
      query,
    });
    res.status(200).json(summary);
  } catch (error) {
    handleError(res, error, { label: 'Error fetching finance summary' });
  }
};

export {
  getCategories,
  createCategoryHandler,
  updateCategoryHandler,
  deleteCategoryHandler,
  getTransactions,
  createTransactionHandler,
  updateTransactionHandler,
  deleteTransactionHandler,
  getSummaryHandler,
};
