import React from 'react';
import { Download, Upload } from 'lucide-react';
import Modal from '../../../components/Modal';
import ApiTokenSection from '../../../components/ApiTokenSection';

const EXTENSION_ZIP_URL = '/captures-extension.zip';

const CaptureSummary = ({ summary }) => {
  if (!summary) return null;

  const created = summary.created ?? [];
  const existing = summary.existing ?? [];
  const failed = summary.failed ?? [];
  const createdProducts = summary.createdProducts ?? [];

  return (
    <div
      data-testid="doterra-import-summary"
      className="rounded-md border border-line bg-base px-4 py-3 space-y-3 text-sm"
    >
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-ink-soft">
        <span>
          Criados:{' '}
          <strong data-testid="doterra-import-created" className="text-ink">
            {created.length}
          </strong>
        </span>
        <span>
          Já existiam:{' '}
          <strong data-testid="doterra-import-existing" className="text-ink">
            {existing.length}
          </strong>
        </span>
        <span>
          Falhas:{' '}
          <strong data-testid="doterra-import-failed" className="text-ink">
            {failed.length}
          </strong>
        </span>
      </div>

      {created.filter((order) => (order.warnings ?? []).length > 0).length >
        0 && (
        <div>
          <p className="text-xs font-semibold text-warning-fg">
            Avisos nos pedidos criados
          </p>
          <ul className="mt-1 space-y-1">
            {created
              .filter((order) => (order.warnings ?? []).length > 0)
              .map((order) => (
                <li key={order.orderNumber} className="text-xs text-ink-soft">
                  <strong className="text-ink">{order.orderNumber}:</strong>{' '}
                  {order.warnings.join(' ')}
                </li>
              ))}
          </ul>
        </div>
      )}

      {failed.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-danger-fg">
            Pedidos não importados
          </p>
          <ul className="mt-1 space-y-1">
            {failed.map((order) => (
              <li key={order.orderNumber} className="text-xs text-ink-soft">
                <strong className="text-ink">{order.orderNumber}:</strong>{' '}
                {order.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {createdProducts.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-info-fg">
            Produtos criados (pendentes de cadastro)
          </p>
          <ul className="mt-1 space-y-1">
            {createdProducts.map((product) => (
              <li key={product.code} className="text-xs text-ink-soft">
                <strong className="text-ink">{product.code}</strong> —{' '}
                {product.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const DoterraImportModal = ({
  isOpen,
  form,
  error,
  submitting,
  summary,
  onChange,
  onSubmit,
  onClose,
}) => (
  <Modal
    isOpen={isOpen}
    title="Importar pedidos dōTERRA"
    onClose={onClose}
    submitting={submitting}
    maxWidth="max-w-2xl"
    testId="doterra-import-modal"
  >
    {(requestClose) => (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="px-6 py-4 space-y-5"
      >
        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-ink">Como capturar?</h4>
          <p className="text-sm text-ink-soft">
            A extensão lê os pedidos direto da sua sessão do dōTERRA e envia ao
            app. Baixe a extensão, abra <strong>office.doterra.com</strong> e
            acesse <strong>Rastreamento de Pedidos e Pacotes</strong>; a caixa
            flutuante mostra os pedidos capturados.
          </p>
          <a
            href={EXTENSION_ZIP_URL}
            download
            data-testid="doterra-import-extension-download"
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Baixar extensão (ZIP)
          </a>
        </section>

        <ApiTokenSection
          testIdPrefix="doterra"
          defaultName="Extensão Pedidos dōTERRA"
        />

        <div>
          <label
            htmlFor="doterra-import-json"
            className="block text-sm font-medium text-ink-soft mb-1"
          >
            JSON dos pedidos
          </label>
          <textarea
            id="doterra-import-json"
            data-testid="doterra-import-json"
            value={form.json}
            onChange={(event) => onChange('json', event.target.value)}
            rows={8}
            spellCheck={false}
            placeholder='{"orders":[{"orderNumber":"184145362","items":[...]}]}'
            className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm font-mono text-xs focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
          />
        </div>

        {error && (
          <div className="p-3 bg-danger-soft rounded-md">
            <p className="text-sm text-danger-fg">{error}</p>
          </div>
        )}

        <CaptureSummary summary={summary} />

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={requestClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            data-testid="doterra-import-submit"
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50"
          >
            <Upload className="w-4 h-4" aria-hidden="true" />
            {submitting ? 'Importando...' : 'Importar'}
          </button>
        </div>
      </form>
    )}
  </Modal>
);

export default DoterraImportModal;
