import express from 'express';
import * as ordersController from '../controllers/ordersController.js';
import * as paymentsController from '../controllers/paymentsController.js';
import * as attachmentsController from '../controllers/orderAttachmentsController.js';
import { upload } from '../middlewares/upload.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @openapi
 * /api/orders:
 *   get:
 *     tags: [Orders]
 *     summary: Lista os pedidos do usuário autenticado
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Busca textual (número do pedido, cliente)
 *       - in: query
 *         name: searchField
 *         schema:
 *           type: string
 *         description: Campo alvo da busca
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Status do pedido (aceita lista separada por vírgula)
 *       - in: query
 *         name: paymentType
 *         schema:
 *           $ref: '#/components/schemas/PaymentType'
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortDir
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Lista de pedidos com itens
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Order'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
// GET /api/orders
router.get('/', ordersController.getOrders);

/**
 * @openapi
 * /api/orders/{id}:
 *   get:
 *     tags: [Orders]
 *     summary: Busca um pedido pelo ID com itens
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Pedido encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// GET /api/orders/:id
router.get('/:id', ordersController.getOrderById);

/**
 * @openapi
 * /api/orders:
 *   post:
 *     tags: [Orders]
 *     summary: Cria um novo pedido com itens
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OrderInput'
 *     responses:
 *       201:
 *         description: Pedido criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
// POST /api/orders
router.post('/', ordersController.createOrder);

/**
 * @openapi
 * /api/orders/{id}:
 *   put:
 *     tags: [Orders]
 *     summary: Atualiza um pedido (sincroniza itens por ID)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OrderUpdateInput'
 *     responses:
 *       200:
 *         description: Pedido atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// PUT /api/orders/:id
router.put('/:id', ordersController.updateOrder);

/**
 * @openapi
 * /api/orders/{id}:
 *   delete:
 *     tags: [Orders]
 *     summary: Exclui um pedido
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Pedido excluído
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// DELETE /api/orders/:id
router.delete('/:id', ordersController.deleteOrder);

/**
 * @openapi
 * /api/orders/{id}/items:
 *   post:
 *     tags: [Orders]
 *     summary: Adiciona um item a um pedido
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OrderItemInput'
 *     responses:
 *       201:
 *         description: Item adicionado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrderItem'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// POST /api/orders/:id/items
router.post('/:id/items', ordersController.addItemToOrder);

/**
 * @openapi
 * /api/orders/items/{id}:
 *   put:
 *     tags: [Orders]
 *     summary: Atualiza um item do pedido
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OrderItemInput'
 *     responses:
 *       200:
 *         description: Item atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrderItem'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// PUT /api/items/:id
router.put('/items/:id', ordersController.updateItem);

/**
 * @openapi
 * /api/orders/items/{id}:
 *   delete:
 *     tags: [Orders]
 *     summary: Exclui um item do pedido
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Item excluído
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// DELETE /api/items/:id
router.delete('/items/:id', ordersController.deleteItem);

/**
 * @openapi
 * /api/orders/{orderId}/payments:
 *   post:
 *     tags: [Orders]
 *     summary: Registra um pagamento em um pedido
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PaymentInput'
 *     responses:
 *       201:
 *         description: Pagamento criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaymentResult'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// POST /api/orders/:orderId/payments
router.post('/:orderId/payments', paymentsController.createPayment);

/**
 * @openapi
 * /api/orders/payments/{id}:
 *   put:
 *     tags: [Orders]
 *     summary: Atualiza um pagamento
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PaymentUpdateInput'
 *     responses:
 *       200:
 *         description: Pagamento atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaymentResult'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// PUT /api/payments/:id
router.put('/payments/:id', paymentsController.updatePayment);

/**
 * @openapi
 * /api/orders/{orderId}/balance:
 *   get:
 *     tags: [Orders]
 *     summary: Saldo por pessoa de um pedido
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Saldo do pedido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrderBalance'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// GET /api/orders/:orderId/balance
router.get('/:orderId/balance', paymentsController.getOrderBalance);

/**
 * @openapi
 * /api/orders/{id}/attachment:
 *   post:
 *     tags: [Orders]
 *     summary: Envia ou substitui o anexo do pedido (print dōTERRA)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Imagem PNG, JPEG ou WebP (máx. 10 MB)
 *     responses:
 *       200:
 *         description: Anexo salvo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AttachmentResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
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

/**
 * @openapi
 * /api/orders/{id}/attachment:
 *   get:
 *     tags: [Orders]
 *     summary: Baixa o anexo do pedido
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Arquivo de imagem do anexo
 *         content:
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 *           image/webp:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// GET /api/orders/:id/attachment
router.get('/:id/attachment', attachmentsController.getAttachment);

/**
 * @openapi
 * /api/orders/{id}/attachment:
 *   delete:
 *     tags: [Orders]
 *     summary: Remove o anexo do pedido
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Anexo removido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// DELETE /api/orders/:id/attachment
router.delete('/:id/attachment', attachmentsController.deleteAttachment);

export default router;
