import express from 'express';
import * as stockController from '../controllers/stockController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

/**
 * @openapi
 * /api/stock:
 *   get:
 *     tags: [Stock]
 *     summary: Lista o saldo em estoque do usuário
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Busca por código ou nome do produto
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [quantity, name, size, code]
 *       - in: query
 *         name: sortDir
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Saldo em estoque
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/InventoryItem'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', stockController.listInventory);

/**
 * @openapi
 * /api/stock/{productId}/history:
 *   get:
 *     tags: [Stock]
 *     summary: Histórico de movimentações de um produto
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Movimentações do produto
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/StockMovement'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:productId/history', stockController.getProductHistory);

/**
 * @openapi
 * /api/stock/movements:
 *   post:
 *     tags: [Stock]
 *     summary: Registra uma movimentação (ENTRADA, SAIDA ou AJUSTE)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MovementInput'
 *     responses:
 *       201:
 *         description: Movimentação registrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MovementResult'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/movements', stockController.registerMovement);

/**
 * @openapi
 * /api/stock/movements/{id}/undo:
 *   post:
 *     tags: [Stock]
 *     summary: Desfaz a última movimentação manual
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Movimentação desfeita
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MovementResult'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/movements/:id/undo', stockController.undoLastMovement);

export default router;
