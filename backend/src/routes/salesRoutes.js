import express from 'express';
import * as salesController from '../controllers/salesController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/sales
router.get('/', salesController.getSales);

// GET /api/sales/:id
router.get('/:id', salesController.getSaleById);

// POST /api/sales
router.post('/', salesController.createSale);

// PUT /api/sales/:id
router.put('/:id', salesController.updateSale);

// DELETE /api/sales/:id
router.delete('/:id', salesController.deleteSale);

export default router;
