import express from 'express';
import * as peopleController from '../controllers/peopleController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @openapi
 * /api/people:
 *   get:
 *     tags: [People]
 *     summary: Lista os clientes do usuário autenticado
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Busca textual por nome, WhatsApp ou observação
 *       - in: query
 *         name: classification
 *         schema:
 *           type: string
 *         description: Filtro de classificação (vip, membro, equipe, próprio)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Campo de ordenação
 *       - in: query
 *         name: sortDir
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: Lista de clientes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Person'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
// GET /api/people
router.get('/', peopleController.getPeople);

/**
 * @openapi
 * /api/people/{id}:
 *   get:
 *     tags: [People]
 *     summary: Busca um cliente pelo ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Cliente encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Person'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// GET /api/people/:id
router.get('/:id', peopleController.getPersonById);

/**
 * @openapi
 * /api/people/{id}/summary:
 *   get:
 *     tags: [People]
 *     summary: Resumo financeiro de um cliente (totais em centavos)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Resumo financeiro
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PersonSummary'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// GET /api/people/:id/summary
router.get('/:id/summary', peopleController.getPersonSummary);

/**
 * @openapi
 * /api/people/{id}/purchases:
 *   get:
 *     tags: [People]
 *     summary: Histórico de compras de um cliente (um item por linha)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Lista de compras
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PersonPurchase'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// GET /api/people/:id/purchases
router.get('/:id/purchases', peopleController.getPersonPurchases);

/**
 * @openapi
 * /api/people:
 *   post:
 *     tags: [People]
 *     summary: Cria um novo cliente
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PersonInput'
 *     responses:
 *       201:
 *         description: Cliente criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Person'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
// POST /api/people
router.post('/', peopleController.createPerson);

/**
 * @openapi
 * /api/people/self:
 *   post:
 *     tags: [People]
 *     summary: Busca ou cria a pessoa "própria" do usuário logado
 *     responses:
 *       200:
 *         description: Pessoa própria existente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Person'
 *       201:
 *         description: Pessoa própria criada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Person'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
// POST /api/people/self
router.post('/self', peopleController.getOrCreateSelfPerson);

/**
 * @openapi
 * /api/people/{id}:
 *   put:
 *     tags: [People]
 *     summary: Atualiza um cliente
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
 *             $ref: '#/components/schemas/PersonInput'
 *     responses:
 *       200:
 *         description: Cliente atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Person'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// PUT /api/people/:id
router.put('/:id', peopleController.updatePerson);

/**
 * @openapi
 * /api/people/{id}:
 *   delete:
 *     tags: [People]
 *     summary: Exclui um cliente
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Cliente excluído
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// DELETE /api/people/:id
router.delete('/:id', peopleController.deletePerson);

export default router;
