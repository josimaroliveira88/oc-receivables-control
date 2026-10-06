import React, { useState } from 'react';
import { Copy, KeyRound, RefreshCw } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';
import {
  useApiTokens,
  TOKEN_TTL_OPTIONS,
  TOKEN_SCOPE_OPTIONS,
} from '../hooks/useApiTokens';

const fieldClass =
  'w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors';

const formatExpiry = (value) =>
  value ? new Date(value).toLocaleString('pt-BR') : '';

// Shared "token for the extension" block used by both capture orientation
// modals (Uber rides and dōTERRA orders). The user picks the scopes the token
// must carry (both checked by default), generates it and copies the cleartext,
// which is shown exactly once.
const ApiTokenSection = ({
  testIdPrefix = 'uber',
  defaultName,
  title = 'Token para a extensão',
}) => {
  const tokens = useApiTokens({ defaultName });
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(tokens.createdToken);
    setCopied(ok);
    if (!ok) {
      // Fallback so the user always has a way to get the token.
      window.prompt('Copie o token abaixo:', tokens.createdToken);
    }
  };

  return (
    <div className="rounded-lg border border-line bg-base px-4 py-4 space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-accent" aria-hidden="true" />
        <h4 className="text-sm font-semibold text-ink">{title}</h4>
      </div>

      {tokens.createdToken ? (
        <div className="space-y-2">
          <p className="text-xs text-warning-fg bg-warning-soft rounded-md px-3 py-2">
            Este token só aparece agora. Copie e cole no popup da extensão
            (campo "Token de acesso").
          </p>
          <div className="flex items-center gap-2">
            <code
              data-testid={`${testIdPrefix}-token-value`}
              className="flex-1 min-w-0 truncate px-3 py-2 text-xs font-mono rounded-md border border-line bg-surface text-ink"
            >
              {tokens.createdToken}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              data-testid={`${testIdPrefix}-token-copy`}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-accent-on-soft bg-accent-soft hover:bg-accent hover:text-accent-on rounded-md transition-colors"
            >
              <Copy className="w-4 h-4" aria-hidden="true" />
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
          {tokens.creation?.expiresAt && (
            <p className="text-xs text-ink-faint">
              Expira em {formatExpiry(tokens.creation.expiresAt)} (termina em{' '}
              {tokens.creation.lastFour}).
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink-soft">
              Escopos do token
            </legend>
            {TOKEN_SCOPE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 text-sm text-ink-soft"
              >
                <input
                  type="checkbox"
                  data-testid={`${testIdPrefix}-token-scope-${option.value}`}
                  checked={tokens.scopes.includes(option.value)}
                  onChange={() => tokens.toggleScope(option.value)}
                  className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
                />
                {option.label}
              </label>
            ))}
          </fieldset>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor={`${testIdPrefix}-token-name`}
                className="block text-sm font-medium text-ink-soft mb-1"
              >
                Nome do token
              </label>
              <input
                id={`${testIdPrefix}-token-name`}
                data-testid={`${testIdPrefix}-token-name`}
                type="text"
                value={tokens.name}
                onChange={(event) => tokens.setName(event.target.value)}
                className={fieldClass}
              />
            </div>
            <div>
              <label
                htmlFor={`${testIdPrefix}-token-ttl`}
                className="block text-sm font-medium text-ink-soft mb-1"
              >
                Validade
              </label>
              <select
                id={`${testIdPrefix}-token-ttl`}
                data-testid={`${testIdPrefix}-token-ttl`}
                value={tokens.ttlDays}
                onChange={(event) =>
                  tokens.setTtlDays(Number(event.target.value))
                }
                className={fieldClass}
              >
                {TOKEN_TTL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {tokens.createError && (
            <p className="text-sm text-danger-fg bg-danger-soft rounded-md px-3 py-2">
              {tokens.createError}
            </p>
          )}

          <button
            type="button"
            onClick={() => tokens.createToken()}
            disabled={tokens.creating}
            data-testid={`${testIdPrefix}-token-generate`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50"
          >
            <KeyRound className="w-4 h-4" aria-hidden="true" />
            {tokens.creating ? 'Gerando...' : 'Gerar token para a extensão'}
          </button>
        </div>
      )}

      {tokens.tokens.length > 0 && (
        <div className="pt-2 border-t border-line">
          <p className="text-xs font-medium text-ink-soft mb-2">
            Tokens existentes
          </p>
          <ul className="space-y-1.5">
            {tokens.tokens.map((token) => (
              <li
                key={token.id}
                className="flex items-center justify-between gap-2 text-xs text-ink-soft"
              >
                <span className="min-w-0 truncate">
                  {token.name} · termina em {token.lastFour} ·{' '}
                  {token.revokedAt ? 'revogado' : 'ativo'}
                </span>
                {!token.revokedAt && (
                  <button
                    type="button"
                    onClick={() => tokens.revokeToken(token.id)}
                    disabled={tokens.revokingId === token.id}
                    data-testid={`${testIdPrefix}-token-revoke-${token.id}`}
                    className="inline-flex items-center gap-1 text-danger-fg hover:underline disabled:opacity-50"
                  >
                    <RefreshCw className="w-3 h-3" aria-hidden="true" />
                    Revogar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ApiTokenSection;
