import React, { useState } from 'react';
import { ExternalLink, Download } from 'lucide-react';
import Modal from '../../../components/Modal';
import ApiTokenSection from '../../../components/ApiTokenSection';

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

// The body owns the "don't show again" state; the token block is shared with
// the dōTERRA orders import modal.
const WelcomeModalBody = ({ onClose, onOpenImport, onOpenGuide, userName }) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const close = () => {
    if (dontShowAgain) {
      localStorage.setItem(DismissedKey, 'true');
    }
    onClose();
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

        <ApiTokenSection
          testIdPrefix="uber"
          defaultName="Extensão Corridas Uber"
        />

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
