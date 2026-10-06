import express from 'express';
import * as doterraOrdersController from '../controllers/doterraOrdersController.js';
import { authenticateToken } from '../middlewares/auth.js';
import { authenticateDoterraImport } from '../middlewares/apiTokenAuth.js';

const router = express.Router();

// `/orders/lookup` and `/orders/import` run FIRST with the composed middleware
// that also accepts a scoped API token (`cr_…` with `doterra:import`; the
// Chrome extension calls them without a session). Everything defined after
// `router.use(authenticateToken)` is session-JWT only.

/**
 * @openapi
 * /api/doterra/orders/lookup:
 *   post:
 *     tags: [Doterra]
 *     summary: Verifica quais números de pedido já existem para o usuário
 *     description: |
 *       Usado pela extensão antes de importar, para buscar as páginas de
 *       detalhe apenas dos pedidos ainda não cadastrados. Aceita o JWT de
 *       sessão ou um token de API com escopo `doterra:import`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DoterraLookupInput'
 *     responses:
 *       200:
 *         description: Números existentes e ausentes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DoterraLookupOutput'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Token sem o escopo doterra:import
 */
// POST /api/doterra/orders/lookup
router.post(
  '/orders/lookup',
  authenticateDoterraImport,
  doterraOrdersController.lookupOrdersHandler,
);

/**
 * @openapi
 * /api/doterra/orders/import:
 *   post:
 *     tags: [Doterra]
 *     summary: Importa pedidos dōTERRA capturados pela extensão
 *     description: |
 *       Cria pedidos de compra marcados como "pendente de revisão" (idempotente
 *       por número de pedido). Códigos ausentes do catálogo viram produtos
 *       rascunho (`PENDENTE_CADASTRO`). Sucesso parcial: um pedido inválido não
 *       desfaz os demais. Aceita o JWT de sessão ou um token de API com escopo
 *       `doterra:import`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DoterraOrderImportInput'
 *     responses:
 *       200:
 *         description: Resumo da importação
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DoterraOrderImportSummary'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Token sem o escopo doterra:import
 */
// POST /api/doterra/orders/import
router.post(
  '/orders/import',
  authenticateDoterraImport,
  doterraOrdersController.importOrdersHandler,
);

// Session-JWT-only from this point; API tokens are rejected here.
router.use(authenticateToken);

export default router;
