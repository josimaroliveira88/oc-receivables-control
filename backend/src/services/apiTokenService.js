// Scoped API tokens for trusted first-party integrations (the Chrome
// extension). The cleartext token is returned exactly once by the create
// endpoint; storage holds only its SHA-256 hash plus the last four cleartext
// characters so the UI can identify the row without ever recovering the token.
// Every read/write is scoped by `userId`.
import { createHash, randomBytes } from 'node:crypto';
import { forbidden, notFound } from '../utils/httpError.js';

// Identifiable prefix, so the auth middleware can tell an API token from a
// session JWT (`cr_` never appears in a JWT, which starts with `eyJ`).
export const API_TOKEN_PREFIX = 'cr_';

export const API_TOKEN_SCOPES = ['uber:import', 'doterra:import'];

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

// Normalizes the requested scopes (accepting the legacy single `scope` string)
// into a non-empty, deduplicated, known-scope list. Unknown values are
// dropped; an empty result falls back to `uber:import` so existing callers
// that send nothing keep working.
const normalizeScopes = (requested) => {
  const list = Array.isArray(requested)
    ? requested
    : requested
      ? [requested]
      : [];
  const unique = [
    ...new Set(list.filter((value) => API_TOKEN_SCOPES.includes(value))),
  ];
  return unique.length > 0 ? unique : ['uber:import'];
};

// Public shape (everything except the hash): safe to return on every endpoint.
const publicToken = (record) => ({
  id: record.id,
  name: record.name,
  scope: record.scope,
  lastFour: record.lastFour,
  expiresAt: record.expiresAt,
  revokedAt: record.revokedAt,
  createdAt: record.createdAt,
});

const createApiToken = async (
  client,
  { userId, name, scopes, scope, ttlDays = 30 },
) => {
  const token = `${API_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  const scopeValue = normalizeScopes(scopes ?? scope).join(',');

  const record = await client.apiToken.create({
    data: {
      userId,
      name,
      scope: scopeValue,
      tokenHash: hashToken(token),
      lastFour: token.slice(-4),
      expiresAt,
    },
  });

  return { ...publicToken(record), token };
};

const listApiTokens = async (client, { userId }) => {
  const records = await client.apiToken.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }],
  });
  return records.map(publicToken);
};

// Soft-revocation is idempotent: revoking a nonexistent or foreign row fails
// with 404; revoking an already-revoked token just reports success.
const revokeApiToken = async (client, { userId, tokenId }) => {
  const record = await client.apiToken.findFirst({
    where: { id: tokenId, userId },
  });

  if (!record) {
    throw notFound('Token não encontrado');
  }

  const updated = await client.apiToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });
  return publicToken(updated);
};

// Middleware helper: validates a cleartext token against the scope. Returns
// `{ userId }` on success or throws the HTTP-mapped rejection translated by
// errorResponse.js. Status mapping: unknown/revoked/expired = 401 (re-auth);
// a valid token of another scope = 403 (insufficient permission).
const authorizeApiToken = async (client, { token, scope }) => {
  const unauthorized = (message) => {
    const error = new Error(message);
    error.status = 401;
    return error;
  };

  if (!token.startsWith(API_TOKEN_PREFIX)) {
    throw unauthorized('Token inválido');
  }

  const record = await client.apiToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!record || record.revokedAt) {
    throw unauthorized('Token inválido ou revogado');
  }

  if (record.expiresAt.getTime() <= Date.now()) {
    throw unauthorized('Token expirado. Gere um novo no app');
  }

  if (!record.scope.split(',').includes(scope)) {
    throw forbidden('Token sem permissão para esta ação');
  }

  return { userId: record.userId };
};

export { createApiToken, listApiTokens, revokeApiToken, authorizeApiToken };
