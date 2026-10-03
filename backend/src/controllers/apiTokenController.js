import prisma from '../config/database.js';
import { handleError } from '../middlewares/errorResponse.js';
import { apiTokenCreateSchema } from '../validators/apiTokenValidator.js';
import {
  createApiToken,
  listApiTokens,
  revokeApiToken,
} from '../services/apiTokenService.js';

const listApiTokensHandler = async (req, res) => {
  try {
    const tokens = await listApiTokens(prisma, {
      userId: req.user.userId,
    });
    res.status(200).json(tokens);
  } catch (error) {
    handleError(res, error, { label: 'Error listing API tokens' });
  }
};

// The cleartext token is part of this response only — never again.
const createApiTokenHandler = async (req, res) => {
  try {
    const payload = apiTokenCreateSchema.parse(req.body);
    const token = await createApiToken(prisma, {
      userId: req.user.userId,
      ...payload,
    });
    res.status(201).json(token);
  } catch (error) {
    handleError(res, error, { label: 'Error creating API token' });
  }
};

const revokeApiTokenHandler = async (req, res) => {
  try {
    const token = await revokeApiToken(prisma, {
      userId: req.user.userId,
      tokenId: req.params.id,
    });
    res.status(200).json(token);
  } catch (error) {
    handleError(res, error, { label: 'Error revoking API token' });
  }
};

export { listApiTokensHandler, createApiTokenHandler, revokeApiTokenHandler };
