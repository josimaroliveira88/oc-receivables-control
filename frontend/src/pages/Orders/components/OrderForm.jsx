import React, { useEffect } from 'react';
import { ExternalLink, Plus } from 'lucide-react';
import { formatBRL } from '../../../utils/money';
import { fromCents } from '../../../utils/money';
import {
  trackingUrl,
  lineValueCents,
  effectivePvCents,
} from '../utils/orderHelpers';
import OrderItemFields from './OrderItemFields';
import OrderTotals from './OrderTotals';

const OrderForm = ({
  orderNumber,
  orderNumberBlurred,
  orderDate,
  isTeamOrder,
  accountOwner,
  paymentType,
  orderNotes,
  shippingValue,
  shippingValueError,
  items,
  people,
  products,
  isEdit,
  orderNumberError,
  itemErrors,
  onChangeField,
  onItemUpdate,
  onItemPersonSelect,
  onItemProductSelect,
  onAddItem,
  onRemoveItem,
  addItemBtnRef,
  onSubmit,
  onCancel,
}) => {
  useEffect(() => {
    const firstError = document.querySelector(
      '[data-testid^="order-item-error-"]',
    );
    if (firstError && typeof firstError.scrollIntoView === 'function') {
      firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [itemErrors]);

  const totalChargedCents = items.reduce(
    (total, item) => total + lineValueCents(item),
    0,
  );

  const totalPvCents = items.reduce(
    (total, item) => total + effectivePvCents(item),
    0,
  );

  return (
    <form onSubmit={onSubmit} className="px-6 py-4">
      <div className="mb-4">
        <label
          htmlFor="orderNumber"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Número do Pedido
        </label>
        <input
          id="orderNumber"
          type="text"
          value={orderNumber}
          onChange={(e) => onChangeField('orderNumber', e.target.value)}
          onBlur={() => onChangeField('orderNumberBlurred', true)}
          required
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
          placeholder="Informe o número do pedido da dōTERRA"
        />
        {orderNumberBlurred && orderNumber.trim() && (
          <div className="mt-1">
            <a
              href={trackingUrl(orderNumber.trim())}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ver pedido no site
            </a>
          </div>
        )}
        {orderNumberError && (
          <div
            data-testid="order-number-error"
            className="mt-1 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md"
          >
            <p className="text-sm text-red-600 dark:text-red-400">
              {orderNumberError}
            </p>
          </div>
        )}
      </div>

      <div className="mb-4">
        <label
          htmlFor="accountOwner"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Responsável pela conta (ID dōTERRA ou nome)
        </label>
        <input
          id="accountOwner"
          type="text"
          value={accountOwner}
          onChange={(e) => onChangeField('accountOwner', e.target.value)}
          maxLength={120}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
          placeholder="Ex.: 6254862 ou Ana Silva"
        />
      </div>

      <div className="mb-4">
        <label className="flex items-start gap-2 cursor-pointer select-none">
          <input
            id="isTeamOrder"
            type="checkbox"
            checked={isTeamOrder}
            onChange={(e) => onChangeField('isTeamOrder', e.target.checked)}
            data-testid="order-is-team-order"
            className="mt-1 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Pedido da equipe (outra pessoa fez o pedido e pagou)
          </span>
        </label>
        {isTeamOrder && (
          <p
            data-testid="order-team-notice"
            className="mt-1 ml-7 text-xs text-gray-500 dark:text-gray-400"
          >
            Este pedido é apenas um registro: não entra no controle de
            recebimento, nos seus gastos nem no estoque.
          </p>
        )}
      </div>

      <div className="mb-4">
        <label
          htmlFor="orderDate"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Data do Pedido
        </label>
        <input
          id="orderDate"
          type="date"
          value={orderDate}
          onChange={(e) => onChangeField('orderDate', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
        />
      </div>

      <div className="mb-4">
        <label
          htmlFor="paymentType"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Tipo de Pagamento
        </label>
        <select
          id="paymentType"
          value={paymentType}
          onChange={(e) => onChangeField('paymentType', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
        >
          <option value="">Selecione...</option>
          <option value="PIX">PIX</option>
          <option value="BOLETO">Boleto</option>
          <option value="CARTAO_CREDITO">Cartão de Crédito</option>
        </select>
      </div>

      <div className="mb-4">
        <label
          htmlFor="orderNotes"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Descrição do Pedido
        </label>
        <textarea
          id="orderNotes"
          value={orderNotes}
          onChange={(e) => onChangeField('orderNotes', e.target.value)}
          maxLength={500}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
          placeholder="Acrescente informações adicionais — motivo do pedido, promoções, encomendas, etc."
        />
        <div className="mt-1 text-right text-xs text-gray-400 dark:text-gray-500">
          {orderNotes.length}/500
        </div>
      </div>

      <div className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Soma dos Produtos (Valor Cobrado)
            </div>
            <div
              data-testid="order-totals-charged"
              className="text-lg font-medium text-gray-900 dark:text-gray-100"
            >
              {formatBRL(fromCents(totalChargedCents))}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Soma dos PV
            </div>
            <div
              data-testid="order-totals-pv"
              className="text-lg font-medium text-gray-900 dark:text-gray-100"
            >
              {fromCents(totalPvCents).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            Itens do Pedido
          </span>
        </div>

        {items.map((item, index) => (
          <OrderItemFields
            key={item.id}
            item={item}
            index={index}
            error={itemErrors[item.id]}
            people={people}
            products={products}
            canRemove={items.length > 1}
            isTeamOrder={isTeamOrder}
            onUpdateField={(field, value) => onItemUpdate(index, field, value)}
            onPersonSelect={onItemPersonSelect}
            onProductSelect={(productId) =>
              onItemProductSelect(index, productId)
            }
            onRemove={() => onRemoveItem(index)}
          />
        ))}

        <button
          type="button"
          onClick={onAddItem}
          ref={addItemBtnRef}
          className="w-full px-3 py-2 mt-1 text-sm font-medium text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 rounded-md transition-colors flex items-center justify-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Adicionar Item
        </button>
      </div>

      <OrderTotals
        totalChargedCents={totalChargedCents}
        totalPvCents={totalPvCents}
        shippingValue={shippingValue}
        shippingValueError={shippingValueError}
        onChangeField={onChangeField}
      />

      <div className="flex items-center justify-end space-x-3 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-gradient-to-r from-primary-700 to-primary-500 hover:from-primary-800 hover:to-primary-600 text-white font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
        >
          {isEdit ? 'Atualizar' : 'Salvar'}
        </button>
      </div>
    </form>
  );
};

export default OrderForm;
