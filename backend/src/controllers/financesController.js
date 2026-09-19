import prisma from '../config/database.js';
import { handleError } from '../middlewares/errorResponse.js';
import {
  createCategorySchema,
  updateCategorySchema,
} from '../validators/financesValidator.js';
import {
  listCategories,
  createCategory,
  updateCategory,
  deactivateCategory,
} from '../services/financeCategoriesService.js';

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

export {
  getCategories,
  createCategoryHandler,
  updateCategoryHandler,
  deleteCategoryHandler,
};
