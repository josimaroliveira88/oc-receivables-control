import express from 'express';
import * as stockController from '../controllers/stockController.js';
import * as stockExchangeController from '../controllers/stockExchangeController.js';
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

/**
 * @openapi
 * /api/stock/exchanges:
 *   post:
 *     tags: [Stock]
 *     summary: Registra uma troca de produtos com outra pessoa
 *     description: |
 *       Cada linha de saída gera um StockMovement SAIDA e cada linha de entrada
 *       gera um StockMovement ENTRADA, todos com `reason` padronizado
 *       `Troca #<id> com <pessoa>: <observação>` e o mesmo `effectiveDate`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [personId, effectiveDate, outgoingLines, incomingLines]
 *             properties:
 *               personId:
 *                 type: string
 *                 format: uuid
 *               effectiveDate:
 *                 type: string
 *                 format: date
 *               observation:
 *                 type: string
 *                 maxLength: 1000
 *               outgoingLines:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [productId, quantity]
 *                   properties:
 *                     productId:
 *                       type: string
 *                       format: uuid
 *                     quantity:
 *                       type: integer
 *                       minimum: 1
 *                     unitValueCents:
 *                       type: integer
 *                       minimum: 0
 *               incomingLines:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   $ref: '#/components/schemas/StockExchangeLineInput'
 *     responses:
 *       201:
 *         description: Troca registrada
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/exchanges', stockExchangeController.createStockExchange);

/**
 * @openapi
 * /api/stock/exchanges:
 *   get:
 *     tags: [Stock]
 *     summary: Lista as trocas de produtos do usuário
 *     description: |
 *       Retorna as trocas ordenadas por data efetiva decrescente, cada uma com a
 *       pessoa, as linhas de saída/entrada e os dados do produto de cada linha.
 *     responses:
 *       200:
 *         description: Trocas do usuário
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/exchanges', stockExchangeController.listStockExchanges);

/**
 * @openapi
 * /api/stock/exchanges/{id}:
 *   get:
 *     tags: [Stock]
 *     summary: Busca uma troca pelo id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Troca encontrada
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/exchanges/:id', stockExchangeController.getStockExchange);

/**
 * @openapi
 * /api/stock/exchanges/{id}:
 *   delete:
 *     tags: [Stock]
 *     summary: Exclui uma troca e reverte o estoque
 *     description: |
 *       Remove a troca, suas linhas e as movimentações de estoque que ela gerou,
 *       recalculando o saldo de cada produto afetado. Falha com 400 se a reversão
 *       deixaria o estoque de algum produto negativo.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Troca excluída
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/exchanges/:id', stockExchangeController.deleteStockExchange);

export default router;
