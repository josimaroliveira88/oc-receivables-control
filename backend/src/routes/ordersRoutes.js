const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/ordersController');

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

module.exports = router;