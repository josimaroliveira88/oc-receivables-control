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

export default router;
