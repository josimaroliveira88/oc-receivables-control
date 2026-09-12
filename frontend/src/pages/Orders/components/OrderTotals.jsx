import React from 'react';
import { formatBRL, fromCents, toCents } from '../../../utils/money';
import CurrencyInput from '../../../components/CurrencyInput';

// Bottom summary block placed after the items list and before the submit
// buttons. Shows the editable order shipping (frete) value together with the
// read-only grand total (products sum + frete), in integer cents.
const OrderTotals = ({
  totalChargedCents,
  shippingValue,
  shippingValueError,
  onChangeField,
}) => {
  const shippingCents =
    shippingValue === '' || shippingValue == null
      ? 0
      : toCents(parseFloat(shippingValue));
  const totalCents = totalChargedCents + shippingCents;

  return (
    <div className="mb-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-base rounded-md p-3">
          <label
            htmlFor="shippingValue"
            className="block text-xs text-ink-faint"
          >
            Frete (R$)
          </label>
          <CurrencyInput
            id="shippingValue"
            data-testid="order-freight"
            value={shippingValue}
            onChange={(e) => onChangeField('shippingValue', e.target.value)}
            className="mt-1 text-sm"
          />
          {shippingValueError && (
            <div
              data-testid="order-freight-error"
              className="mt-1 p-2 bg-danger-soft rounded-md"
            >
              <p className="text-sm text-danger-fg">{shippingValueError}</p>
            </div>
          )}
        </div>
        <div className="bg-base rounded-md p-3">
          <div className="text-xs text-ink-faint">Valor Total</div>
          <div
            data-testid="order-totals-charged-footer"
            className="text-lg font-medium text-ink"
          >
            {formatBRL(fromCents(totalCents))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderTotals;
