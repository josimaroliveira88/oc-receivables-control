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
          <div className="mb-4 rounded-md border border-line bg-base p-3">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <dt className="text-xs text-ink-faint">Número</dt>
                <dd className="text-sm font-medium text-ink">
                  {order.orderNumber}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Data do Pedido</dt>
                <dd className="text-sm font-medium text-ink">
                  {formatDateBR(order.orderDate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Pessoa</dt>
                <dd className="text-sm font-medium text-ink">
                  {personName || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Valor Atual</dt>
                <dd className="text-sm font-medium text-ink">
                  {formatBRL(parseFloat(payment.amount))}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mb-4 p-3 bg-info-soft rounded-md">
            {isSelf ? (
              <p className="text-sm text-info-fg">
                Item do próprio usuário — já recebido, sem efeito no status.
              </p>
            ) : isZeroItem ? (
              <p className="text-sm text-info-fg">
                Nada a receber — baixa sem valor
              </p>
            ) : (
              <p className="text-sm text-info-fg">
                Saldo pendente: <strong>{formatBRL(pendingCents / 100)}</strong>
              </p>
            )}
          </div>

          <div className="mb-4">
            <label
              htmlFor="editPaymentDate"
              className="block text-sm font-medium text-ink-soft mb-1"
            >
              Data do Pagamento
            </label>
            <input
              id="editPaymentDate"
              type="date"
              value={paymentDate}
              onChange={(e) => onChangeDate(e.target.value)}
              className="w-full px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="editPaymentAmount"
              className="block text-sm font-medium text-ink-soft mb-1"
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
              className="block text-sm font-medium text-ink-soft mb-1"
            >
              Forma de Pagamento
            </label>
            <select
              id="editPaymentFormType"
              value={paymentFormType}
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
            <label
              htmlFor="editPaymentNotes"
              className="block text-sm font-medium text-ink-soft mb-1"
            >
              Notas (opcional)
            </label>
            <input
              id="editPaymentNotes"
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
              disabled={submitting}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed"
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
