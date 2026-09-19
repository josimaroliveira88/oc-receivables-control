import React from 'react';
import Modal from '../../../components/Modal';
import CurrencyInput from '../../../components/CurrencyInput';
import { formatBRL } from '../../../utils/money';

const inputClass =
  'w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors';

const GatewaySettlementModal = ({
  isOpen = true,
  sale,
  form,
  formError = '',
  submitting = false,
  isDirty = false,
  onChangeField,
  onSubmit,
  onClose,
}) => {
  const clientName = sale?.items?.[0]?.person?.name || '—';
  const infinitePayTotal = (sale?.payments || [])
    .filter((p) => p.paymentType === 'INFINITE_PAY')
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

  return (
    <Modal
      isOpen={isOpen}
      title="Registrar resgate InfinitePay"
      onClose={onClose}
      isDirty={isDirty}
      submitting={submitting}
      testId="settlement-modal"
      closeAriaLabel="Fechar"
    >
      {(requestClose) => (
        <form onSubmit={onSubmit} className="px-6 py-4">
          {sale && (
            <div className="mb-4 rounded-md border border-line bg-base p-3">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <dt className="text-xs text-ink-faint">Nº Venda</dt>
                  <dd className="text-sm font-medium text-ink">
                    {sale.orderNumber}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-faint">Cliente</dt>
                  <dd className="text-sm font-medium text-ink">{clientName}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-ink-faint">
                    Cobrado no InfinitePay
                  </dt>
                  <dd
                    data-testid="settlement-gross"
                    className="text-sm font-medium text-ink"
                  >
                    {formatBRL(infinitePayTotal)}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-ink-faint">
                A taxa do gateway não gera despesa automática; o valor abaixo é
                o que realmente entrou na conta.
              </p>
            </div>
          )}

          {formError && (
            <div
              data-testid="settlement-form-error"
              className="mb-4 p-3 bg-danger-soft rounded-md"
            >
              <p className="text-sm text-danger-fg">{formError}</p>
            </div>
          )}

          <div className="mb-4">
            <label
              htmlFor="settlementAmount"
              className="block text-sm font-medium text-ink-soft mb-1"
            >
              Valor do resgate (R$)
            </label>
            <CurrencyInput
              id="settlementAmount"
              data-testid="settlement-amount"
              value={form.amount}
              onChange={(e) => onChangeField('amount', e.target.value)}
              placeholder="0,00"
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="settlementDate"
              className="block text-sm font-medium text-ink-soft mb-1"
            >
              Data do resgate
            </label>
            <input
              id="settlementDate"
              type="date"
              value={form.transactionDate}
              onChange={(e) => onChangeField('transactionDate', e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="settlementNotes"
              className="block text-sm font-medium text-ink-soft mb-1"
            >
              Observações (opcional)
            </label>
            <input
              id="settlementNotes"
              type="text"
              value={form.notes}
              onChange={(e) => onChangeField('notes', e.target.value)}
              className={inputClass}
              placeholder="Ex.: resgate parcial"
            />
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={requestClose}
              className="px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Registrando...' : 'Registrar resgate'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default GatewaySettlementModal;
