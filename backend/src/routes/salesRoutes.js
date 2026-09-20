import express from 'express';
import * as salesController from '../controllers/salesController.js';
import * as attachmentsController from '../controllers/orderAttachmentsController.js';
import * as infinitepayController from '../controllers/salesInfinitepayImportController.js';
import {
  uploadSingleAttachment,
  uploadSingleInfinitePayCsv,
} from '../middlewares/upload.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @openapi
 * /api/sales:
 *   get:
 *     tags: [Sales]
 *     summary: Lista as vendas do usuário autenticado
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Busca textual (cliente, produto)
 *       - in: query
 *         name: searchField
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Status da venda (aceita lista separada por vírgula)
 *       - in: query
 *         name: delivered
 *         schema:
 *           type: string
 *         description: Filtro de entrega
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
 *         description: Lista de vendas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Order'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
// GET /api/sales
router.get('/', salesController.getSales);

/**
 * @openapi
 * /api/sales/{id}:
 *   get:
 *     tags: [Sales]
 *     summary: Busca uma venda pelo ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Venda encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// GET /api/sales/:id
router.get('/:id', salesController.getSaleById);

/**
 * @openapi
 * /api/sales:
 *   post:
 *     tags: [Sales]
 *     summary: Cria uma nova venda (baixa de estoque)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SaleInput'
 *     responses:
 *       201:
 *         description: Venda criada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
// POST /api/sales
router.post('/', salesController.createSale);

/**
 * @openapi
 * /api/sales/infinitepay/import:
 *   post:
 *     tags: [Sales]
 *     summary: Importa o extrato CSV do InfinitePay e sugere vendas por valor
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Linhas aprovadas com as vendas sugeridas
 *       400:
 *         description: CSV fora do padrão ou arquivo ausente
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
// POST /api/sales/infinitepay/import
router.post(
  '/infinitepay/import',
  uploadSingleInfinitePayCsv,
  infinitepayController.importInfinitePayStatement,
);

/**
 * @openapi
 * /api/sales/{id}:
 *   put:
 *     tags: [Sales]
 *     summary: Atualiza uma venda
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
 *             $ref: '#/components/schemas/SaleUpdateInput'
 *     responses:
 *       200:
 *         description: Venda atualizada
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
// PUT /api/sales/:id
router.put('/:id', salesController.updateSale);

/**
 * @openapi
 * /api/sales/{id}:
 *   delete:
 *     tags: [Sales]
 *     summary: Exclui uma venda
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Venda excluída
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// DELETE /api/sales/:id
router.delete('/:id', salesController.deleteSale);

/**
 * @openapi
 * /api/sales/{id}/attachment:
 *   post:
 *     tags: [Sales]
 *     summary: Envia (ou substitui) a foto anexa da venda
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
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Foto anexada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 attachmentFilename:
 *                   type: string
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// POST /api/sales/:id/attachment
router.post(
  '/:id/attachment',
  uploadSingleAttachment,
  attachmentsController.uploadAttachment,
);

/**
 * @openapi
 * /api/sales/{id}/attachment:
 *   get:
 *     tags: [Sales]
 *     summary: Baixa a foto anexa da venda
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
// GET /api/sales/:id/attachment
router.get('/:id/attachment', attachmentsController.getAttachment);

/**
 * @openapi
 * /api/sales/{id}/attachment:
 *   delete:
 *     tags: [Sales]
 *     summary: Remove a foto anexa da venda
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
// DELETE /api/sales/:id/attachment
router.delete('/:id/attachment', attachmentsController.deleteAttachment);

export default router;
