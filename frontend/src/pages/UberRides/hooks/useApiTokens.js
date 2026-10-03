import { useEffect, useState } from 'react';
import { useToast } from '../../../components/Toast';
import { errorMessageFrom } from '../../Finances/utils/financeHelpers';
import * as apiTokensApi from '../../../services/apiTokensApi';

// Token TTL options offered by the welcome modal (mirrors the backend enum).
export const TOKEN_TTL_OPTIONS = [
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '90 dias' },
];

// Default token name so the row is identifiable in a future management screen.
export const DEFAULT_TOKEN_NAME = 'Extensão Corridas Uber';

// Owns the API-token state used by the rides welcome modal: the list of the
// user's existing tokens, the not-yet-copied cleartext of the token just
// created (`createdToken`) and the revoke flow. The cleartext lives only in
// memory — it is never persisted on the client.
export function useApiTokens() {
  const { addToast } = useToast();

  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState(DEFAULT_TOKEN_NAME);
  const [ttlDays, setTtlDays] = useState(30);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createdToken, setCreatedToken] = useState('');
  const [creation, setCreation] = useState(null);
  const [revokingId, setRevokingId] = useState('');
  // The list loads on mount; the modal opens/closes around it.

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

  useEffect(() => {
    loadTokens({ showLoading: true });
  }, []);

  const createToken = async ({
    name: requestedName,
    ttlDays: requestedTtl,
  } = {}) => {
    setCreating(true);
    setCreateError('');
    try {
      const { data } = await apiTokensApi.create({
        name: (requestedName ?? name).trim(),
        scope: 'uber:import',
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
