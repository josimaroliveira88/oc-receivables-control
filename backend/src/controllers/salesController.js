import prisma from '../config/database.js';
import { handleError } from '../middlewares/errorResponse.js';
import { removeAttachmentFile } from '../utils/attachmentStorage.js';
import {
  createSaleSchema,
  updateSaleSchema,
} from '../validators/salesValidator.js';
import * as salesService from '../services/salesService.js';

const getSales = async (req, res) => {
  try {
    const result = await salesService.getSales(prisma, {
      userId: req.user.userId,
      query: req.query,
    });
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error, { label: 'Error fetching sales' });
  }
};

const getSaleById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await salesService.getSaleById(prisma, {
      id,
      userId: req.user.userId,
    });
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error, { label: 'Error fetching sale' });
  }
};

const createSale = async (req, res) => {
  try {
    const validatedData = createSaleSchema.parse(req.body);

    const result = await salesService.createSale(prisma, {
      userId: req.user.userId,
      payload: validatedData,
    });

    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, { label: 'Error creating sale' });
  }
};

const updateSale = async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateSaleSchema.parse(req.body);

    const result = await salesService.updateSale(prisma, {
      id,
      userId: req.user.userId,
      payload: validatedData,
    });

    res.status(200).json(result);
  } catch (error) {
    handleError(res, error, { label: 'Error updating sale' });
  }
};

const deleteSale = async (req, res) => {
  try {
    const { id } = req.params;

    const { message, attachmentFilename } = await salesService.deleteSale(
      prisma,
      { id, userId: req.user.userId },
    );

    if (attachmentFilename) {
      removeAttachmentFile(attachmentFilename);
    }

    res.status(200).json({ message });
  } catch (error) {
    handleError(res, error, { label: 'Error deleting sale' });
  }
};

export { getSales, getSaleById, createSale, updateSale, deleteSale };
