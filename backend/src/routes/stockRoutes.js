import express from 'express';
import * as stockController from '../controllers/stockController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', stockController.listInventory);
router.get('/:productId/history', stockController.getProductHistory);
router.post('/movements', stockController.registerMovement);
router.post('/movements/:id/undo', stockController.undoLastMovement);

export default router;
