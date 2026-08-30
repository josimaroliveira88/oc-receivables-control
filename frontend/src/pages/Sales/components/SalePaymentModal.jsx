import React from 'react';
import { formatBRL, fromCents } from '../../../utils/money';
import { formatDateBR } from '../../../utils/dates';
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
          <div className="mb-4 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-3">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  Nº Venda
                </dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {sale.orderNumber}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  Data
                </dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {formatDateBR(sale.orderDate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  Cliente
                </dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {clientName || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  Valor Total
                </dt>
                <dd
                  data-testid="sale-summary-total"
                  className="text-sm font-medium text-gray-900 dark:text-gray-100"
                >
                  {formatBRL(parseFloat(sale.totalValue))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  Frete
                </dt>
                <dd
                  data-testid="sale-summary-shipping"
                  className="text-sm font-medium text-gray-900 dark:text-gray-100"
                >
                  {formatBRL(parseFloat(sale.shippingValue || 0))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  Valores Adicionais
                </dt>
                <dd
                  data-testid="sale-summary-additional"
                  className="text-sm font-medium text-gray-900 dark:text-gray-100"
                >
                  {formatBRL(parseFloat(sale.additionalValue || 0))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  Valor Pendente
                </dt>
                <dd
                  data-testid="sale-summary-pending"
                  className="text-sm font-medium text-gray-900 dark:text-gray-100"
                >
                  {formatBRL(orderPendingCents / 100)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  Descrição
                </dt>
                <dd
                  data-testid="sale-summary-description"
                  className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate"
                  title={sale.orderNotes || undefined}
                >
                  {sale.orderNotes || '—'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md">
            {selectedIsZeroItem ? (
              <p className="text-sm text-blue-700 dark:text-blue-400">
                Nada a receber — baixa sem valor
              </p>
            ) : (
              <p className="text-sm text-blue-700 dark:text-blue-400">
                Saldo pendente:{' '}
                <strong>{formatBRL(selectedPendingCents / 100)}</strong>
              </p>
            )}
          </div>

          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Itens desta pessoa
            </h4>
            {selectedPersonItems.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Nenhum item registrado para esta pessoa
              </p>
            ) : (
              <div className="rounded-md border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700 overflow-hidden">
                {selectedPersonItems.map((item) => (
                  <div
                    key={item.id}
                    className="px-3 py-2 bg-white dark:bg-gray-800"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {item.description || '—'}
                      </span>
                      <span className="text-sm font-semibold text-primary-700 dark:text-primary-400 whitespace-nowrap">
                        {formatBRL(fromCents(lineValueCents(item)))}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
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
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Data do Pagamento
            </label>
            <input
              id="salePaymentDate"
              type="date"
              value={paymentDate}
              onChange={(e) => onChangeDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Valor (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={paymentAmount}
              onChange={(e) => onChangeAmount(e.target.value)}
              disabled={selectedIsZeroItem}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="0.00"
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="salePaymentFormType"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Forma de Pagamento
            </label>
            <select
              id="salePaymentFormType"
              value={paymentType}
              onChange={(e) => onChangePaymentType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            >
              <option value="">Não informada</option>
              <option value="PIX">PIX</option>
              <option value="BOLETO">Boleto</option>
              <option value="CARTAO_CREDITO">Cartão de Crédito</option>
              <option value="INFINITE_PAY">InfinitePay</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notas (opcional)
            </label>
            <input
              type="text"
              value={paymentNotes}
              onChange={(e) => onChangeNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              placeholder="Observações sobre o pagamento"
            />
          </div>

          {paymentError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">
                {paymentError}
              </p>
            </div>
          )}

          <div className="flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={requestClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || balances.length === 0}
              className="px-4 py-2 bg-gradient-to-r from-primary-700 to-primary-500 hover:from-primary-800 hover:to-primary-600 disabled:from-primary-400 disabled:to-primary-300 text-white font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
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
