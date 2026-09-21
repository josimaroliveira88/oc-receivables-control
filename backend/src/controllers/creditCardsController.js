import prisma from '../config/database.js';
import { handleError } from '../middlewares/errorResponse.js';
import {
  createBillSchema,
  updateBillSchema,
  payInstallmentSchema,
  reconcilePreviewSchema,
  reconcileCommitSchema,
} from '../validators/creditCardsValidator.js';
import {
  listBills,
  getBill,
  createManualBill,
  updateBill,
  deleteBill,
  payInstallment,
  unpayInstallment,
} from '../services/creditCardService.js';
import {
  previewReconcile,
  commitReconcile,
  undoReconcileBatch,
} from '../services/creditCardReconcileService.js';

const getBills = async (req, res) => {
  try {
    const bills = await listBills(prisma, req.user.userId);
    res.status(200).json(bills);
  } catch (error) {
    handleError(res, error, { label: 'Error fetching credit card bills' });
  }
};

const getBillHandler = async (req, res) => {
  try {
    const bill = await getBill(prisma, req.user.userId, req.params.id);
    res.status(200).json(bill);
  } catch (error) {
    handleError(res, error, { label: 'Error fetching credit card bill' });
  }
};

const createBillHandler = async (req, res) => {
  try {
    const payload = createBillSchema.parse(req.body);
    const bill = await createManualBill(prisma, {
      userId: req.user.userId,
      payload,
    });
    res.status(201).json(bill);
  } catch (error) {
    handleError(res, error, { label: 'Error creating credit card bill' });
  }
};

const updateBillHandler = async (req, res) => {
  try {
    const payload = updateBillSchema.parse(req.body);
    const bill = await updateBill(prisma, {
      userId: req.user.userId,
      id: req.params.id,
      payload,
    });
    res.status(200).json(bill);
  } catch (error) {
    handleError(res, error, { label: 'Error updating credit card bill' });
  }
};

const deleteBillHandler = async (req, res) => {
  try {
    await deleteBill(prisma, { userId: req.user.userId, id: req.params.id });
    res.status(200).json({ message: 'Credit card bill deleted successfully' });
  } catch (error) {
    handleError(res, error, { label: 'Error deleting credit card bill' });
  }
};

const payInstallmentHandler = async (req, res) => {
  try {
    const payload = payInstallmentSchema.parse(req.body);
    const installment = await payInstallment(prisma, {
      userId: req.user.userId,
      id: req.params.id,
      paidAt: payload.paidAt,
    });
    res.status(200).json(installment);
  } catch (error) {
    handleError(res, error, { label: 'Error paying credit card installment' });
  }
};

const unpayInstallmentHandler = async (req, res) => {
  try {
    const installment = await unpayInstallment(prisma, {
      userId: req.user.userId,
      id: req.params.id,
    });
    res.status(200).json(installment);
  } catch (error) {
    handleError(res, error, {
      label: 'Error reverting credit card installment',
    });
  }
};

const previewReconcileHandler = async (req, res) => {
  try {
    const payload = reconcilePreviewSchema.parse(req.body);
    const preview = await previewReconcile(prisma, {
      userId: req.user.userId,
      ofxText: payload.ofxText,
    });
    res.status(200).json(preview);
  } catch (error) {
    handleError(res, error, {
      label: 'Error previewing credit card reconcile',
    });
  }
};

const commitReconcileHandler = async (req, res) => {
  try {
    const payload = reconcileCommitSchema.parse(req.body);
    const result = await commitReconcile(prisma, {
      userId: req.user.userId,
      batchId: payload.batchId,
      matches: payload.matches,
    });
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error, {
      label: 'Error committing credit card reconcile',
    });
  }
};

const undoReconcileBatchHandler = async (req, res) => {
  try {
    const result = await undoReconcileBatch(prisma, {
      userId: req.user.userId,
      batchId: req.params.batchId,
    });
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error, { label: 'Error undoing credit card reconcile' });
  }
};

export {
  getBills,
  getBillHandler,
  createBillHandler,
  updateBillHandler,
  deleteBillHandler,
  payInstallmentHandler,
  unpayInstallmentHandler,
  previewReconcileHandler,
  commitReconcileHandler,
  undoReconcileBatchHandler,
};
