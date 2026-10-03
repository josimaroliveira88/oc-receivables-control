// Import-route authorization: accepts a session JWT (the app's normal auth,
// defaulting to this route) OR a scoped API token (the Chrome extension, whose
// fetch carries `Bearer cr_…`). The token prefix makes the dispatch safe:
// `cr_` never appears in a JWT, which starts with `eyJ`.
// Only this composed middleware applies; every other route stays JWT-only via
// middlewares/auth.js.
import prisma from '../config/database.js';
import { authenticateToken } from './auth.js';
import { authorizeApiToken } from '../services/apiTokenService.js';
import { API_TOKEN_PREFIX } from '../services/apiTokenService.js';
import { handleError } from './errorResponse.js';

// The one scope the import route accepts; a token of any other scope is a 403.
const IMPORT_SCOPE = 'uber:import';

const authenticateUberImport = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso obrigatório' });
  }

  if (!token.startsWith(API_TOKEN_PREFIX)) {
    // Session JWT: delegate to the standard middleware.
    return authenticateToken(req, res, next);
  }

  authorizeApiToken(prisma, { token, scope: IMPORT_SCOPE })
    .then((payload) => {
      req.user = { userId: payload.userId };
      next();
    })
    .catch((error) => handleError(res, error, { label: 'API token auth' }));
};

export { authenticateUberImport, IMPORT_SCOPE };
