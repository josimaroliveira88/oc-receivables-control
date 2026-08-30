import React from 'react';
import { formatBRL } from '../../../utils/money';
import { formatDateBR } from '../../../utils/dates';
import CurrencyInput from '../../../components/CurrencyInput';
import Modal from '../../../components/Modal';

const EditPaymentModal = ({
  order,
  payment,
  personName,
  isSelf,
  isZeroItem,
  pendingCents,
  paymentAmount,
  paymentNotes,
  paymentDate,
  paymentFormType,
  paymentError,
  submitting,
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
      title={`Editar Pagamento — ${order.orderNumber}`}
      onClose={onClose}
      isDirty={isDirty}
      submitting={submitting}
      testId="edit-payment-modal"
      closeAriaLabel="Fechar edição de pagamento"
    >
      {(requestClose) => (
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
                  Data do Pedido
                </dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {formatDateBR(order.orderDate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  Pessoa
                </dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {personName || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  Valor Atual
                </dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {formatBRL(parseFloat(payment.amount))}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md">
            {isSelf ? (
              <p className="text-sm text-blue-700 dark:text-blue-400">
                Item do próprio usuário — já recebido, sem efeito no status.
              </p>
            ) : isZeroItem ? (
              <p className="text-sm text-blue-700 dark:text-blue-400">
                Nada a receber — baixa sem valor
              </p>
            ) : (
              <p className="text-sm text-blue-700 dark:text-blue-400">
                Saldo pendente: <strong>{formatBRL(pendingCents / 100)}</strong>
              </p>
            )}
          </div>

          <div className="mb-4">
            <label
              htmlFor="editPaymentDate"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Data do Pagamento
            </label>
            <input
              id="editPaymentDate"
              type="date"
              value={paymentDate}
              onChange={(e) => onChangeDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="editPaymentAmount"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Valor (R$)
            </label>
            <CurrencyInput
              id="editPaymentAmount"
              value={paymentAmount}
              onChange={(e) => onChangeAmount(e.target.value)}
              placeholder="0,00"
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="editPaymentFormType"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Forma de Pagamento
            </label>
            <select
              id="editPaymentFormType"
              value={paymentFormType}
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
            <label
              htmlFor="editPaymentNotes"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Notas (opcional)
            </label>
            <input
              id="editPaymentNotes"
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
              disabled={submitting}
              className="px-4 py-2 bg-gradient-to-r from-primary-700 to-primary-500 hover:from-primary-800 hover:to-primary-600 text-white font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Atualizando...' : 'Atualizar'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default EditPaymentModal;
