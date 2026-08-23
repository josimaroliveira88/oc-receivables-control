import React from 'react';
import { formatBRL, toCents, fromCents } from '../../../utils/money';
import { formatDateBR } from '../../../utils/dates';
import { lineValueCents } from '../utils/orderHelpers';

const PaymentModal = ({
  order,
  balances,
  selectedPersonId,
  paymentAmount,
  paymentNotes,
  paymentDate,
  paymentError,
  submitting,
  orderPendingCents,
  selectedPendingCents,
  selectedIsZeroItem,
  selectedIsSelf,
  selectedPersonItems,
  onClose,
  onChangePerson,
  onChangeAmount,
  onChangeNotes,
  onChangeDate,
  onSubmit,
}) => {
  return (
    <div
      data-testid="payment-modal"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Registrar Pagamento — {order.orderNumber}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none"
          >
            &times;
          </button>
        </div>
        <form onSubmit={onSubmit} className="px-6 py-4">
          <div className="mb-4 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-3">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  Número
                </dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {order.orderNumber}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  Data
                </dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {formatDateBR(order.orderDate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  Responsável
                </dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {order.accountOwner || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  Valor Total
                </dt>
                <dd
                  data-testid="order-summary-total"
                  className="text-sm font-medium text-gray-900 dark:text-gray-100"
                >
                  {formatBRL(parseFloat(order.totalValue))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  Frete
                </dt>
                <dd
                  data-testid="order-summary-shipping"
                  className="text-sm font-medium text-gray-900 dark:text-gray-100"
                >
                  {formatBRL(parseFloat(order.shippingValue || 0))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  Valor Pendente
                </dt>
                <dd
                  data-testid="order-summary-pending"
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
                  data-testid="order-summary-description"
                  className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate"
                  title={order.orderNotes || undefined}
                >
                  {order.orderNotes || '—'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Pessoa
            </label>
            {balances.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Nenhuma pessoa neste pedido
              </p>
            ) : (
              <select
                value={selectedPersonId}
                onChange={(e) => onChangePerson(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              >
                {balances.map((b) => (
                  <option key={b.personId} value={b.personId}>
                    {toCentsLabel(b)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedPersonId && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md">
              {selectedIsSelf ? (
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  Item do próprio usuário — já recebido, sem valor a registrar.
                </p>
              ) : selectedIsZeroItem ? (
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
          )}

          {selectedPersonId && (
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
          )}

          <div className="mb-4">
            <label
              htmlFor="paymentDate"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Data do Pagamento
            </label>
            <input
              id="paymentDate"
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
              disabled={selectedIsZeroItem || selectedIsSelf}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="0.00"
            />
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
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || balances.length === 0 || selectedIsSelf}
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
      </div>
    </div>
  );
};

const toCentsLabel = (balance) => {
  const name = balance.isSelf
    ? `${balance.personName} (Você)`
    : balance.personName;
  if (balance.isSelf) {
    return `${name} — Recebido`;
  }
  return toCents(balance.itemTotal) === 0
    ? `${name} — Nada a receber`
    : `${name} — Pendente: ${formatBRL(balance.pending)}`;
};

export default PaymentModal;
