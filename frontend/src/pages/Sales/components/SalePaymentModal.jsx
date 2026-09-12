import React from 'react';
import { formatBRL, fromCents } from '../../../utils/money';
import { formatDateBR } from '../../../utils/dates';
import CurrencyInput from '../../../components/CurrencyInput';
import { lineValueCents } from '../utils/saleHelpers';
import Modal from '../../../components/Modal';

const SalePaymentModal = ({
  sale,
  balances,
  clientName,
  paymentAmount,
  paymentNotes,
  paymentDate,
  paymentType,
  paymentError,
  submitting,
  orderPendingCents,
  selectedPendingCents,
  selectedIsZeroItem,
  selectedPersonItems,
  isDirty = false,
  onClose,
  onChangeAmount,
  onChangeNotes,
  onChangeDate,
  onChangePaymentType,
  onSubmit,
}) => {
  return (
    <Modal
      title={`Registrar Pagamento — ${sale.orderNumber}`}
      onClose={onClose}
      isDirty={isDirty}
      submitting={submitting}
      testId="sale-payment-modal"
      closeAriaLabel="Fechar pagamento"
    >
      {(requestClose) => (
        <form onSubmit={onSubmit} className="px-6 py-4">
          <div className="mb-4 rounded-md border border-line bg-base p-3">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <dt className="text-xs text-ink-faint">Nº Venda</dt>
                <dd className="text-sm font-medium text-ink">
                  {sale.orderNumber}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Data</dt>
                <dd className="text-sm font-medium text-ink">
                  {formatDateBR(sale.orderDate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Cliente</dt>
                <dd className="text-sm font-medium text-ink">
                  {clientName || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Valor Total</dt>
                <dd
                  data-testid="sale-summary-total"
                  className="text-sm font-medium text-ink"
                >
                  {formatBRL(parseFloat(sale.totalValue))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Frete</dt>
                <dd
                  data-testid="sale-summary-shipping"
                  className="text-sm font-medium text-ink"
                >
                  {formatBRL(parseFloat(sale.shippingValue || 0))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Valores Adicionais</dt>
                <dd
                  data-testid="sale-summary-additional"
                  className="text-sm font-medium text-ink"
                >
                  {formatBRL(parseFloat(sale.additionalValue || 0))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Valor Pendente</dt>
                <dd
                  data-testid="sale-summary-pending"
                  className="text-sm font-medium text-ink"
                >
                  {formatBRL(orderPendingCents / 100)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Descrição</dt>
                <dd
                  data-testid="sale-summary-description"
                  className="text-sm font-medium text-ink truncate"
                  title={sale.orderNotes || undefined}
                >
                  {sale.orderNotes || '—'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mb-4 p-3 bg-info-soft rounded-md">
            {selectedIsZeroItem ? (
              <p className="text-sm text-info-fg">
                Nada a receber — baixa sem valor
              </p>
            ) : (
              <p className="text-sm text-info-fg">
                Saldo pendente:{' '}
                <strong>{formatBRL(selectedPendingCents / 100)}</strong>
              </p>
            )}
          </div>

          <div className="mb-4">
            <h4 className="text-sm font-medium text-ink-soft mb-2">
              Itens desta pessoa
            </h4>
            {selectedPersonItems.length === 0 ? (
              <p className="text-sm text-ink-faint">
                Nenhum item registrado para esta pessoa
              </p>
            ) : (
              <div className="rounded-md border border-line divide-y divide-line overflow-hidden">
                {selectedPersonItems.map((item) => (
                  <div key={item.id} className="px-3 py-2 bg-surface">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-ink">
                        {item.description || '—'}
                      </span>
                      <span className="text-sm font-semibold text-accent whitespace-nowrap">
                        {formatBRL(fromCents(lineValueCents(item)))}
                      </span>
                    </div>
                    <p className="text-xs text-ink-faint mt-0.5">
                      {item.quantity > 1 ? `Qtd: ${item.quantity} · ` : ''}
                      {`Detalhes: ${item.details || '—'}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mb-4">
            <label
              htmlFor="salePaymentDate"
              className="block text-sm font-medium text-ink-soft mb-1"
            >
              Data do Pagamento
            </label>
            <input
              id="salePaymentDate"
              type="date"
              value={paymentDate}
              onChange={(e) => onChangeDate(e.target.value)}
              className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-ink-soft mb-1">
              Valor (R$)
            </label>
            <CurrencyInput
              value={paymentAmount}
              onChange={(e) => onChangeAmount(e.target.value)}
              disabled={selectedIsZeroItem}
              placeholder="0,00"
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="salePaymentFormType"
              className="block text-sm font-medium text-ink-soft mb-1"
            >
              Forma de Pagamento
            </label>
            <select
              id="salePaymentFormType"
              value={paymentType}
              onChange={(e) => onChangePaymentType(e.target.value)}
              className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
            >
              <option value="">Não informada</option>
              <option value="PIX">PIX</option>
              <option value="BOLETO">Boleto</option>
              <option value="CARTAO_CREDITO">Cartão de Crédito</option>
              <option value="INFINITE_PAY">InfinitePay</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-ink-soft mb-1">
              Notas (opcional)
            </label>
            <input
              type="text"
              value={paymentNotes}
              onChange={(e) => onChangeNotes(e.target.value)}
              className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
              placeholder="Observações sobre o pagamento"
            />
          </div>

          {paymentError && (
            <div className="mb-4 p-3 bg-danger-soft rounded-md">
              <p className="text-sm text-danger-fg">{paymentError}</p>
            </div>
          )}

          <div className="flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={requestClose}
              className="px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink bg-base hover:bg-elevated rounded-md transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || balances.length === 0}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting
                ? 'Registrando...'
                : selectedIsZeroItem
                  ? 'Dar baixa'
                  : 'Registrar Pagamento'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default SalePaymentModal;
