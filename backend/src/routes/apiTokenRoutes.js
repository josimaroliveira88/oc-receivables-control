import express from 'express';
import * as apiTokenController from '../controllers/apiTokenController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

// Managing tokens requires a session JWT; an API token cannot mint tokens.
router.use(authenticateToken);

/**
 * @openapi
 * /api/api-tokens:
 *   get:
 *     tags: [ApiTokens]
 *     summary: Lista os tokens de API do usuário
 *     description: |
 *       Tokens para integrações de primeira parte (extensão do Chrome).
 *       A resposta nunca inclui o token em claro nem o hash — apenas os
 *       quatro últimos caracteres para identificar o token na interface.
 *     responses:
 *       200:
 *         description: Tokens do usuário
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ApiToken'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
// GET /api/api-tokens
router.get('/', apiTokenController.listApiTokensHandler);

/**
 * @openapi
 * /api/api-tokens:
 *   post:
 *     tags: [ApiTokens]
 *     summary: Cria um token de API para a extensão
 *     description: |
 *       Devolve o token em claro **uma única vez** (prefixo `cr_`). O banco
 *       guarda apenas o hash SHA-256, então não há como recuperá-lo depois.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApiTokenCreateInput'
 *     responses:
 *       201:
 *         description: Token criado (inclui `token` em claro, único retorno)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiTokenCreated'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
// POST /api/api-tokens
router.post('/', apiTokenController.createApiTokenHandler);

/**
 * @openapi
 * /api/api-tokens/{id}:
 *   delete:
 *     tags: [ApiTokens]
 *     summary: Revoga um token de API
 *     description: Revogação lógica e idempotente; outra pessoa não enxerga nem revoga o token.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Token revogado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiToken'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
// DELETE /api/api-tokens/:id
router.delete('/:id', apiTokenController.revokeApiTokenHandler);

export default router;
