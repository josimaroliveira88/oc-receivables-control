const express = require('express');
const router = express.Router();
const stockController = require('../controllers/StockController');
const { authenticateToken } = require('../middlewares/auth');

router.use(authenticateToken);

router.get('/', stockController.listInventory);
router.get('/:productId/history', stockController.getProductHistory);
router.post('/movements', stockController.registerMovement);
router.post('/movements/:id/undo', stockController.undoLastMovement);

module.exports = router;
