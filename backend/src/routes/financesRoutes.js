import express from 'express';
import * as financesController from '../controllers/financesController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @openapi
 * /api/finances/categories:
 *   get:
 *     tags: [Finances]
 *     summary: Lista as categorias financeiras do usuário
 *     description: Garante as categorias padrão no primeiro acesso e retorna ativas e inativas.
 *     responses:
 *       200:
 *         description: Categorias do usuário
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/FinancialCategory'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
// GET /api/finances/categories
router.get('/categories', financesController.getCategories);

/**
 * @openapi
 * /api/finances/categories:
 *   post:
 *     tags: [Finances]
 *     summary: Cria uma categoria financeira personalizada
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FinancialCategoryInput'
 *     responses:
 *       201:
 *         description: Categoria criada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FinancialCategory'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
// POST /api/finances/categories
router.post('/categories', financesController.createCategoryHandler);

/**
 * @openapi
 * /api/finances/categories/{id}:
 *   put:
 *     tags: [Finances]
 *     summary: Renomeia ou (des)ativa uma categoria financeira
 *     description: O tipo da categoria é imutável; a desativação é sempre lógica.
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
 *             $ref: '#/components/schemas/FinancialCategoryUpdateInput'
 *     responses:
 *       200:
 *         description: Categoria atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FinancialCategory'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
// PUT /api/finances/categories/:id
router.put('/categories/:id', financesController.updateCategoryHandler);

/**
 * @openapi
 * /api/finances/categories/{id}:
 *   delete:
 *     tags: [Finances]
 *     summary: Desativa logicamente uma categoria financeira
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Categoria desativada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// DELETE /api/finances/categories/:id
router.delete('/categories/:id', financesController.deleteCategoryHandler);

/**
 * @openapi
 * /api/finances/transactions:
 *   get:
 *     tags: [Finances]
 *     summary: Lista os lançamentos financeiros do usuário
 *     description: Retorna o conjunto filtrado completo, ordenado por data e criação (desc).
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { $ref: '#/components/schemas/FinancialTransactionType' }
 *       - in: query
 *         name: origin
 *         schema: { $ref: '#/components/schemas/FinancialOrigin' }
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: q
 *         description: Busca textual em descrição e observações
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lançamentos do usuário
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/FinancialTransaction'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
// GET /api/finances/transactions
router.get('/transactions', financesController.getTransactions);

/**
 * @openapi
 * /api/finances/transactions:
 *   post:
 *     tags: [Finances]
 *     summary: Cria um lançamento financeiro manual
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FinancialTransactionInput'
 *     responses:
 *       201:
 *         description: Lançamento criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FinancialTransaction'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
// POST /api/finances/transactions
router.post('/transactions', financesController.createTransactionHandler);

/**
 * @openapi
 * /api/finances/transactions/{id}:
 *   put:
 *     tags: [Finances]
 *     summary: Atualiza um lançamento manual
 *     description: Apenas lançamentos com origem MANUAL podem ser editados.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FinancialTransactionUpdateInput'
 *     responses:
 *       200:
 *         description: Lançamento atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FinancialTransaction'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// PUT /api/finances/transactions/:id
router.put('/transactions/:id', financesController.updateTransactionHandler);

/**
 * @openapi
 * /api/finances/transactions/{id}:
 *   delete:
 *     tags: [Finances]
 *     summary: Exclui um lançamento manual
 *     description: Apenas lançamentos com origem MANUAL podem ser excluídos.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Lançamento excluído
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// DELETE /api/finances/transactions/:id
router.delete('/transactions/:id', financesController.deleteTransactionHandler);

/**
 * @openapi
 * /api/finances/summary:
 *   get:
 *     tags: [Finances]
 *     summary: Totais do período filtrado
 *     description: Aceita os mesmos filtros da listagem e calcula sobre o conjunto completo.
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { $ref: '#/components/schemas/FinancialTransactionType' }
 *       - in: query
 *         name: origin
 *         schema: { $ref: '#/components/schemas/FinancialOrigin' }
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Totais de receitas, despesas e saldo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FinancialSummary'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
// GET /api/finances/summary
router.get('/summary', financesController.getSummaryHandler);

export default router;
