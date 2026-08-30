import React from 'react';
import { formatBRL, fromCents } from '../../../utils/money';

// Bottom summary block placed after the items list and before the submit
// buttons. Shows the read-only products sum together with the editable order
// shipping (frete) value.
const OrderTotals = ({
  totalChargedCents,
  shippingValue,
  shippingValueError,
  onChangeField,
}) => {
  return (
    <div className="mb-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3">
          <label
            htmlFor="shippingValue"
            className="block text-xs text-gray-500 dark:text-gray-400"
          >
            Frete (R$)
          </label>
          <input
            id="shippingValue"
            type="number"
            step="0.01"
            min="0"
            data-testid="order-freight"
            value={shippingValue}
            onChange={(e) => onChangeField('shippingValue', e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm"
          />
          {shippingValueError && (
            <div
              data-testid="order-freight-error"
              className="mt-1 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md"
            >
              <p className="text-sm text-red-600 dark:text-red-400">
                {shippingValueError}
              </p>
            </div>
          )}
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Soma dos Produtos (Valor Cobrado)
          </div>
          <div
            data-testid="order-totals-charged-footer"
            className="text-lg font-medium text-gray-900 dark:text-gray-100"
          >
            {formatBRL(fromCents(totalChargedCents))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderTotals;
