import React, { useState } from 'react';
import {
  Copy,
  ExternalLink,
  Download,
  KeyRound,
  RefreshCw,
} from 'lucide-react';
import Modal from '../../../components/Modal';
import { copyToClipboard } from '../../../utils/clipboard';
import { useApiTokens, TOKEN_TTL_OPTIONS } from '../hooks/useApiTokens';
import { formatRideDateTime } from '../utils/uberRideHelpers';

const fieldClass =
  'w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors';

// The extension is packaged at build time into `frontend/public/` and served by
// the app. The browser cannot read local paths (and the backend may run in a
// container that does not see the host filesystem), so the orientation hands
// over a downloadable ZIP and the "extract then load unpacked" steps.
const EXTENSION_ZIP_URL = '/uber-rides-extension.zip';
const EXTENSION_STEPS = [
  'Baixe o ZIP (botão acima) e descompacte em uma pasta.',
  'Abra chrome://extensions e ative o "Modo do desenvolvedor".',
  'Clique em "Carregar sem compactação" e selecione a pasta descompactada.',
  'Abra riders.uber.com e faça login normalmente.',
  'Na caixa "Corridas Uber", clique em "Enviar para o Controle de Recebíveis".',
];

const DismissedKey = 'uber-rides-welcome-dismissed';

const UberRidesWelcomeModal = ({
  isOpen,
  onClose,
  onOpenImport,
  onOpenGuide,
  userName,
}) => {
  if (!isOpen) return null;

  return (
    <WelcomeModalBody
      onClose={onClose}
      onOpenImport={onOpenImport}
      onOpenGuide={onOpenGuide}
      userName={userName}
    />
  );
};

// The body owns the token hook so the API list is only fetched while the modal
// is actually open.
const WelcomeModalBody = ({ onClose, onOpenImport, onOpenGuide, userName }) => {
  const tokens = useApiTokens();
  const [copied, setCopied] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const close = () => {
    if (dontShowAgain) {
      localStorage.setItem(DismissedKey, 'true');
    }
    onClose();
  };

  const handleCopy = async () => {
    const ok = await copyToClipboard(tokens.createdToken);
    setCopied(ok);
    if (!ok) {
      // Fallback so the user always has a way to get the token.
      window.prompt('Copie o token abaixo:', tokens.createdToken);
    }
  };

  return (
    <Modal
      isOpen
      title="Como capturar as corridas do Uber?"
      onClose={close}
      maxWidth="max-w-2xl"
      testId="uber-rides-welcome-modal"
      closeAriaLabel="Fechar"
    >
      <div className="px-6 py-5 space-y-5">
        <p className="text-sm text-ink-soft">
          {userName ? `Conectado como ${userName}. ` : ''}A extensão captura as
          corridas direto da sua sessão do Uber e envia ao app — você não
          precisa colar o JSON.
        </p>

        <div className="flex flex-wrap gap-2">
          <a
            href={EXTENSION_ZIP_URL}
            download
            data-testid="uber-rides-extension-download"
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Baixar extensão (ZIP)
          </a>
          <button
            type="button"
            onClick={onOpenGuide}
            data-testid="uber-rides-welcome-guide-link"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors"
          >
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
            Ver instruções detalhadas
          </button>
        </div>

        <p className="text-xs text-ink-faint">
          A extensão não está na Chrome Web Store: baixe o ZIP, descompacte e
          carregue a pasta em chrome://extensions &gt; &quot;Carregar sem
          compactação&quot;.
        </p>

        <ol className="space-y-2 list-decimal list-inside text-sm text-ink-soft">
          {EXTENSION_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <div className="rounded-lg border border-line bg-base px-4 py-4 space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-accent" aria-hidden="true" />
            <h4 className="text-sm font-semibold text-ink">
              Token para a extensão
            </h4>
          </div>

          {tokens.createdToken ? (
            <div className="space-y-2">
              <p className="text-xs text-warning-fg bg-warning-soft rounded-md px-3 py-2">
                Este token só aparece agora. Copie e cole no popup da extensão
                (campo "Token de acesso").
              </p>
              <div className="flex items-center gap-2">
                <code
                  data-testid="uber-rides-token-value"
                  className="flex-1 min-w-0 truncate px-3 py-2 text-xs font-mono rounded-md border border-line bg-surface text-ink"
                >
                  {tokens.createdToken}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  data-testid="uber-rides-token-copy"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-accent-on-soft bg-accent-soft hover:bg-accent hover:text-accent-on rounded-md transition-colors"
                >
                  <Copy className="w-4 h-4" aria-hidden="true" />
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              {tokens.creation?.expiresAt && (
                <p className="text-xs text-ink-faint">
                  Expira em {formatRideDateTime(tokens.creation.expiresAt)}{' '}
                  (termina em {tokens.creation.lastFour}).
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="uber-token-name"
                    className="block text-sm font-medium text-ink-soft mb-1"
                  >
                    Nome do token
                  </label>
                  <input
                    id="uber-token-name"
                    data-testid="uber-token-name"
                    type="text"
                    value={tokens.name}
                    onChange={(event) => tokens.setName(event.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label
                    htmlFor="uber-token-ttl"
                    className="block text-sm font-medium text-ink-soft mb-1"
                  >
                    Validade
                  </label>
                  <select
                    id="uber-token-ttl"
                    data-testid="uber-token-ttl"
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
                data-testid="uber-rides-generate-token"
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
                        data-testid={`uber-token-revoke-${token.id}`}
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

        <label className="inline-flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            data-testid="uber-rides-welcome-dismiss"
            checked={dontShowAgain}
            onChange={(event) => setDontShowAgain(event.target.checked)}
            className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
          />
          Não mostrar esta orientação de novo
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={close}
            data-testid="uber-rides-welcome-close"
            className="px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={() => {
              close();
              onOpenImport();
            }}
            data-testid="uber-rides-welcome-open-import"
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
          >
            Importar corridas
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default UberRidesWelcomeModal;
