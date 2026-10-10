import express from 'express';
import * as productController from '../controllers/productController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @openapi
 * /api/products:
 *   get:
 *     tags: [Products]
 *     summary: Lista o catálogo de produtos (paginado)
 *     parameters:
 *       - in: query
 *         name: active
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *         description: Atalho legado para status ATIVO/INATIVO
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Status do produto (aceita repetição do parâmetro)
 *       - in: query
 *         name: available
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *         description: "'true' restringe a ATIVO e INDISPONIVEL"
 *       - in: query
 *         name: inStock
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *         description: "'true' restringe a produtos com inventário do usuário"
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Busca por nome ou código
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortDir
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Catálogo paginado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedProducts'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
// GET /api/products
router.get('/', productController.getProducts);

/**
 * @openapi
 * /api/products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Busca um produto pelo ID com preço vigente
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Produto encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// GET /api/products/:id
router.get('/:id', productController.getProductById);

/**
 * @openapi
 * /api/products/{id}/usage:
 *   get:
 *     tags: [Products]
 *     summary: Locais onde o produto é usado e o que bloqueia sua exclusão
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Snapshot de uso do produto
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// GET /api/products/:id/usage
router.get('/:id/usage', productController.getProductUsageHandler);

/**
 * @openapi
 * /api/products/{id}/references/{kind}:
 *   delete:
 *     tags: [Products]
 *     summary: Remove um tipo de referência (inventory, stock-movements, exchange-lines, kit-component)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: kind
 *         required: true
 *         schema:
 *           type: string
 *           enum: [inventory, stock-movements, exchange-lines, kit-component]
 *     responses:
 *       200:
 *         description: Referência removida
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// DELETE /api/products/:id/references/:kind
router.delete(
  '/:id/references/:kind',
  productController.removeProductReferenceHandler,
);

/**
 * @openapi
 * /api/products/{id}/purge:
 *   post:
 *     tags: [Products]
 *     summary: Exclui o produto e remove todas as referências em uma transação
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Produto excluído
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// POST /api/products/:id/purge
router.post('/:id/purge', productController.purgeProductHandler);

/**
 * @openapi
 * /api/products:
 *   post:
 *     tags: [Products]
 *     summary: Cria um produto (simples ou KIT com composição)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductInput'
 *     responses:
 *       201:
 *         description: Produto criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
// POST /api/products
router.post('/', productController.createProduct);

/**
 * @openapi
 * /api/products/{id}:
 *   put:
 *     tags: [Products]
 *     summary: Atualiza um produto (preço versionado, composição do KIT)
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
 *             $ref: '#/components/schemas/ProductUpdateInput'
 *     responses:
 *       200:
 *         description: Produto atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// PUT /api/products/:id
router.put('/:id', productController.updateProduct);

/**
 * @openapi
 * /api/products/{id}:
 *   delete:
 *     tags: [Products]
 *     summary: Exclui fisicamente um produto (bloqueia com 409 se houver referências)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Produto excluído
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
// DELETE /api/products/:id
router.delete('/:id', productController.deleteProduct);

export default router;
