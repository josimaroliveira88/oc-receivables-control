import express from 'express';
import * as uberRidesController from '../controllers/uberRidesController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @openapi
 * /api/uber/rides:
 *   get:
 *     tags: [Uber]
 *     summary: Lista as corridas do usuário
 *     description: Filtra por período, status, perfil e se a corrida já foi lançada no financeiro.
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [COMPLETED, CANCELLED] }
 *       - in: query
 *         name: source
 *         schema: { $ref: '#/components/schemas/RideSource' }
 *       - in: query
 *         name: profileType
 *         schema: { type: string }
 *       - in: query
 *         name: rideType
 *         schema: { $ref: '#/components/schemas/RideType' }
 *       - in: query
 *         name: launched
 *         schema: { type: string, enum: [yes, no] }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Corridas do usuário
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/RideRecord'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
// GET /api/uber/rides
router.get('/rides', uberRidesController.listRidesHandler);

/**
 * @openapi
 * /api/uber/rides/import:
 *   post:
 *     tags: [Uber]
 *     summary: Importa as corridas de um JSON colado
 *     description: Faz o parse do JSON do script de captura e faz upsert das corridas. Idempotente.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RideImportInput'
 *     responses:
 *       200:
 *         description: Resumo da importação
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RideImportSummary'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
// POST /api/uber/rides/import
router.post('/rides/import', uberRidesController.importRidesHandler);

/**
 * @openapi
 * /api/uber/rides/expenses:
 *   post:
 *     tags: [Uber]
 *     summary: Lança as corridas selecionadas como despesas no financeiro
 *     description: Cria uma despesa por corrida (origem UBER). Rejeita corrida cancelada ou já lançada.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RideExpenseInput'
 *     responses:
 *       201:
 *         description: Lançamentos criados
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
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// POST /api/uber/rides/expenses
router.post('/rides/expenses', uberRidesController.createRideExpensesHandler);

/**
 * @openapi
 * /api/uber/rides/batch/{batchId}:
 *   delete:
 *     tags: [Uber]
 *     summary: Desfaz uma importação
 *     description: Remove as corridas do lote que ainda não têm lançamento. Idempotente.
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Quantidade removida e mantida
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
// DELETE /api/uber/rides/batch/:batchId
router.delete(
  '/rides/batch/:batchId',
  uberRidesController.deleteRideBatchHandler,
);

export default router;
