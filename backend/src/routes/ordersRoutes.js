const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/ordersController');
const paymentsController = require('../controllers/paymentsController');
const attachmentsController = require('../controllers/orderAttachmentsController');
const { upload } = require('../middlewares/upload');
const { authenticateToken } = require('../middlewares/auth');

// All routes require authentication
router.use(authenticateToken);

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
router.post('/:orderId/payments', paymentsController.createPayment);

// PUT /api/payments/:id
router.put('/payments/:id', paymentsController.updatePayment);

// GET /api/orders/:orderId/balance
router.get('/:orderId/balance', paymentsController.getOrderBalance);

// POST /api/orders/:id/attachment
router.post(
  '/:id/attachment',
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err.code === 'INVALID_FILE_TYPE') {
          return res.status(400).json({ error: 'Invalid file type' });
        }
        return next(err);
      }
      next();
    });
  },
  attachmentsController.uploadAttachment,
);

// GET /api/orders/:id/attachment
router.get('/:id/attachment', attachmentsController.getAttachment);

// DELETE /api/orders/:id/attachment
router.delete('/:id/attachment', attachmentsController.deleteAttachment);

module.exports = router;
