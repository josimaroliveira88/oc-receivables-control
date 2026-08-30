const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { authenticateToken } = require('../middlewares/auth');

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

module.exports = router;
