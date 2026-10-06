import { useEffect, useState } from 'react';
import { useToast } from '../components/Toast';
import { errorMessageFrom } from '../pages/Finances/utils/financeHelpers';
import * as apiTokensApi from '../services/apiTokensApi';

// Token TTL options offered by the token UI (mirrors the backend enum).
export const TOKEN_TTL_OPTIONS = [
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '90 dias' },
];

// The scopes a capture token may carry. Both are checked by default so a
// single token serves the Uber rides and the dōTERRA orders captures.
export const TOKEN_SCOPE_OPTIONS = [
  { value: 'uber:import', label: 'Corridas Uber (uber:import)' },
  { value: 'doterra:import', label: 'Pedidos dōTERRA (doterra:import)' },
];

export const DEFAULT_TOKEN_SCOPES = ['uber:import', 'doterra:import'];

// Default token name so the row is identifiable in a management screen.
export const DEFAULT_TOKEN_NAME = 'Extensão Corridas Uber';

// Owns the API-token state used by the capture modals: the list of the user's
// existing tokens, the selected scopes, the not-yet-copied cleartext of the
// token just created (`createdToken`) and the revoke flow. The cleartext lives
// only in memory — it is never persisted on the client.
export function useApiTokens({ defaultName = DEFAULT_TOKEN_NAME } = {}) {
  const { addToast } = useToast();

  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState(defaultName);
  const [ttlDays, setTtlDays] = useState(30);
  const [scopes, setScopes] = useState(DEFAULT_TOKEN_SCOPES);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createdToken, setCreatedToken] = useState('');
  const [creation, setCreation] = useState(null);
  const [revokingId, setRevokingId] = useState('');

  const loadTokens = async ({ showLoading = false } = {}) => {
    if (showLoading) setLoading(true);
    try {
      const { data } = await apiTokensApi.list();
      setTokens(data);
      setLoadError('');
    } catch (_err) {
      setLoadError('Não foi possível carregar os tokens. Tente novamente.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadTokens({ showLoading: true });
  }, []);

  const toggleScope = (scope) => {
    setScopes((previous) =>
      previous.includes(scope)
        ? previous.filter((value) => value !== scope)
        : [...previous, scope],
    );
  };

  const createToken = async ({
    name: requestedName,
    ttlDays: requestedTtl,
    scopes: requestedScopes,
  } = {}) => {
    const effectiveScopes = requestedScopes ?? scopes;
    if (effectiveScopes.length === 0) {
      setCreateError('Selecione ao menos um escopo.');
      return;
    }

    setCreating(true);
    setCreateError('');
    try {
      const { data } = await apiTokensApi.create({
        name: (requestedName ?? name).trim(),
        scopes: effectiveScopes,
        ttlDays: requestedTtl ?? ttlDays,
      });
      setCreatedToken(data.token);
      const { token: _cleartext, ...publicRecord } = data;
      setCreation(publicRecord);
      setTokens((previous) => [publicRecord, ...previous]);
      addToast(
        'Token gerado. Guarde-o agora — ele não será mostrado de novo.',
        'success',
      );
    } catch (err) {
      setCreateError(
        errorMessageFrom(
          err,
          'Não foi possível gerar o token. Tente novamente.',
        ),
      );
    } finally {
      setCreating(false);
    }
  };

  const revokeToken = async (id) => {
    setRevokingId(id);
    try {
      const { data } = await apiTokensApi.remove(id);
      setTokens((previous) =>
        previous.map((token) => (token.id === id ? data : token)),
      );
      if (creation?.id === id) {
        setCreatedToken('');
        setCreation(null);
      }
      addToast('Token revogado com sucesso!', 'success');
    } catch (err) {
      addToast(
        errorMessageFrom(err, 'Não foi possível revogar o token.'),
        'error',
      );
    } finally {
      setRevokingId('');
    }
  };

  return {
    tokens,
    loading,
    loadError,
    reload: loadTokens,
    name,
    setName,
    ttlDays,
    setTtlDays,
    scopes,
    setScopes,
    toggleScope,
    creating,
    createError,
    createdToken,
    creation,
    createToken,
    clearCreated: () => setCreatedToken(''),
    revokeToken,
    revokingId,
  };
}
