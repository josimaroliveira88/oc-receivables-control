import express from 'express';
import * as creditCardsController from '../controllers/creditCardsController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticateToken);

/**
 * @openapi
 * /api/credit-cards/bills:
 *   get:
 *     tags: [CreditCards]
 *     summary: Lista as faturas de cartão de crédito do usuário
 *     responses:
 *       200:
 *         description: Faturas do usuário, com suas parcelas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CreditCardBill'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
// GET /api/credit-cards/bills
router.get('/bills', creditCardsController.getBills);

/**
 * @openapi
 * /api/credit-cards/bills:
 *   post:
 *     tags: [CreditCards]
 *     summary: Cria uma fatura manual com parcelas pendentes
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreditCardBillInput'
 *     responses:
 *       201:
 *         description: Fatura criada com as parcelas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreditCardBill'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
// POST /api/credit-cards/bills
router.post('/bills', creditCardsController.createBillHandler);

/**
 * @openapi
 * /api/credit-cards/bills/{id}:
 *   get:
 *     tags: [CreditCards]
 *     summary: Detalha uma fatura com suas parcelas
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Fatura com as parcelas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreditCardBill'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// GET /api/credit-cards/bills/:id
router.get('/bills/:id', creditCardsController.getBillHandler);

/**
 * @openapi
 * /api/credit-cards/bills/{id}:
 *   put:
 *     tags: [CreditCards]
 *     summary: Atualiza os metadados de uma fatura
 *     description: Regenera as parcelas pendentes quando o total, o número de parcelas, a data ou a categoria mudam. Retorna 409 se houver parcela efetiva.
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
 *             $ref: '#/components/schemas/CreditCardBillUpdateInput'
 *     responses:
 *       200:
 *         description: Fatura atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreditCardBill'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 */
// PUT /api/credit-cards/bills/:id
router.put('/bills/:id', creditCardsController.updateBillHandler);

/**
 * @openapi
 * /api/credit-cards/bills/{id}:
 *   delete:
 *     tags: [CreditCards]
 *     summary: Exclui uma fatura sem parcelas efetivas
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Fatura excluída
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
// DELETE /api/credit-cards/bills/:id
router.delete('/bills/:id', creditCardsController.deleteBillHandler);

/**
 * @openapi
 * /api/credit-cards/installments/{id}/pay:
 *   post:
 *     tags: [CreditCards]
 *     summary: Marca uma parcela como paga
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
 *             $ref: '#/components/schemas/InstallmentPaymentInput'
 *     responses:
 *       200:
 *         description: Parcela efetivada
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
// POST /api/credit-cards/installments/:id/pay
router.post(
  '/installments/:id/pay',
  creditCardsController.payInstallmentHandler,
);

/**
 * @openapi
 * /api/credit-cards/installments/{id}/unpay:
 *   post:
 *     tags: [CreditCards]
 *     summary: Desfaz a baixa de uma parcela
 *     description: Volta a parcela para pendente (isEffective false). Idempotente para parcela já pendente.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Parcela pendente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FinancialTransaction'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// POST /api/credit-cards/installments/:id/unpay
router.post(
  '/installments/:id/unpay',
  creditCardsController.unpayInstallmentHandler,
);

/**
 * @openapi
 * /api/credit-cards/reconcile/preview:
 *   post:
 *     tags: [CreditCards]
 *     summary: Lê o extrato OFX e sugere conciliações com as parcelas pendentes
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReconcilePreviewInput'
 *     responses:
 *       200:
 *         description: Linhas do extrato com as parcelas sugeridas e o lote
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReconcilePreview'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
// POST /api/credit-cards/reconcile/preview
router.post(
  '/reconcile/preview',
  creditCardsController.previewReconcileHandler,
);

/**
 * @openapi
 * /api/credit-cards/reconcile/commit:
 *   post:
 *     tags: [CreditCards]
 *     summary: Confirma as conciliações de um lote
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReconcileCommitInput'
 *     responses:
 *       200:
 *         description: Parcelas conciliadas
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// POST /api/credit-cards/reconcile/commit
router.post('/reconcile/commit', creditCardsController.commitReconcileHandler);

/**
 * @openapi
 * /api/credit-cards/reconcile/batch/{batchId}:
 *   delete:
 *     tags: [CreditCards]
 *     summary: Desfaz uma conciliação inteira
 *     description: Devolve as parcelas do lote para pendente. Idempotente.
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Quantidade de parcelas restauradas
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
// DELETE /api/credit-cards/reconcile/batch/:batchId
router.delete(
  '/reconcile/batch/:batchId',
  creditCardsController.undoReconcileBatchHandler,
);

export default router;
