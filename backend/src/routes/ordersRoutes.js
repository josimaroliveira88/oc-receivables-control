const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/ordersController');
const paymentsController = require('../controllers/paymentsController');
const { authenticateToken } = require('../middlewares/auth');

// GET /api/orders
router.get('/', ordersController.getOrders);

// GET /api/orders/:id
router.get('/:id', ordersController.getOrderById);

// POST /api/orders
router.post('/', ordersController.createOrder);

// PUT /api/orders/:id
router.put('/:id', ordersController.updateOrder);

// DELETE /api/orders/:id
router.delete('/:id', ordersController.deleteOrder);

// POST /api/orders/:id/items
router.post('/:id/items', ordersController.addItemToOrder);

// PUT /api/items/:id
router.put('/items/:id', ordersController.updateItem);

// DELETE /api/items/:id
router.delete('/items/:id', ordersController.deleteItem);

// POST /api/orders/:orderId/payments
router.post('/:orderId/payments', authenticateToken, paymentsController.createPayment);

// GET /api/orders/:orderId/balance
router.get('/:orderId/balance', authenticateToken, paymentsController.getOrderBalance);

module.exports = router;