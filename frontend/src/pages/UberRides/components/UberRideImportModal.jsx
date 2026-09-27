import React from 'react';
import Modal from '../../../components/Modal';

const fieldClass =
  'w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors';

const UberRideImportModal = ({
  isOpen,
  form,
  error,
  submitting,
  isDirty,
  onChange,
  onSubmit,
  onClose,
}) => (
  <Modal
    isOpen={isOpen}
    title="Importar corridas"
    onClose={onClose}
    isDirty={isDirty}
    submitting={submitting}
    maxWidth="max-w-2xl"
    testId="uber-ride-import-modal"
  >
    {(requestClose) => (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="px-6 py-4 space-y-4"
      >
        <p className="text-sm text-ink-soft">
          Cole abaixo o JSON gerado pelo script de captura do Uber. As corridas
          já importadas são reconhecidas e não são duplicadas.
        </p>

        <div>
          <label
            htmlFor="uber-ride-import-json"
            className="block text-sm font-medium text-ink-soft mb-1"
          >
            JSON das corridas
          </label>
          <textarea
            id="uber-ride-import-json"
            data-testid="uber-ride-import-json"
            value={form.json}
            onChange={(event) => onChange('json', event.target.value)}
            rows={8}
            spellCheck={false}
            placeholder='{"profiles":{"FAMILY":{"atividades":[...]}}}'
            className={`${fieldClass} font-mono text-xs`}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="uber-ride-import-window-start"
              className="block text-sm font-medium text-ink-soft mb-1"
            >
              Início da janela (opcional)
            </label>
            <input
              id="uber-ride-import-window-start"
              data-testid="uber-ride-import-window-start"
              type="datetime-local"
              value={form.windowStart}
              onChange={(event) => onChange('windowStart', event.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label
              htmlFor="uber-ride-import-window-end"
              className="block text-sm font-medium text-ink-soft mb-1"
            >
              Fim da janela (opcional)
            </label>
            <input
              id="uber-ride-import-window-end"
              data-testid="uber-ride-import-window-end"
              type="datetime-local"
              value={form.windowEnd}
              onChange={(event) => onChange('windowEnd', event.target.value)}
              className={fieldClass}
            />
          </div>
        </div>

        {error && (
          <div className="p-3 bg-danger-soft rounded-md">
            <p className="text-sm text-danger-fg">{error}</p>
          </div>
        )}

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
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50"
          >
            {submitting ? 'Importando...' : 'Importar'}
          </button>
        </div>
      </form>
    )}
  </Modal>
);

export default UberRideImportModal;
