// Import-route authorization: accepts a session JWT (the app's normal auth,
// defaulting to this route) OR a scoped API token (the Chrome extension, whose
// fetch carries `Bearer cr_…`). The token prefix makes the dispatch safe:
// `cr_` never appears in a JWT, which starts with `eyJ`.
// Only the composed middlewares apply; every other route stays JWT-only via
// middlewares/auth.js.
import prisma from '../config/database.js';
import { authenticateToken } from './auth.js';
import { authorizeApiToken } from '../services/apiTokenService.js';
import { API_TOKEN_PREFIX } from '../services/apiTokenService.js';
import { handleError } from './errorResponse.js';

// The scopes the import routes accept; a token without the matching scope is a
// 403. A token may carry several scopes (comma-joined), so a single token can
// serve both the Uber and the dōTERRA captures.
const IMPORT_SCOPE = 'uber:import';
const DOTERRA_IMPORT_SCOPE = 'doterra:import';

// Builds the composed middleware for one import scope. Kept as a factory so the
// two import routes share the exact dispatch logic and only differ by scope.
const createImportAuth = (scope) => (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso obrigatório' });
  }

  if (!token.startsWith(API_TOKEN_PREFIX)) {
    // Session JWT: delegate to the standard middleware.
    return authenticateToken(req, res, next);
  }

  authorizeApiToken(prisma, { token, scope })
    .then((payload) => {
      req.user = { userId: payload.userId };
      next();
    })
    .catch((error) => handleError(res, error, { label: 'API token auth' }));
};

const authenticateUberImport = createImportAuth(IMPORT_SCOPE);
const authenticateDoterraImport = createImportAuth(DOTERRA_IMPORT_SCOPE);

export {
  authenticateUberImport,
  authenticateDoterraImport,
  IMPORT_SCOPE,
  DOTERRA_IMPORT_SCOPE,
};
