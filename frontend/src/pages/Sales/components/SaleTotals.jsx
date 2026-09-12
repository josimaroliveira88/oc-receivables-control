import React from 'react';
import { formatBRL, fromCents, toCents } from '../../../utils/money';
import CurrencyInput from '../../../components/CurrencyInput';

// Bottom summary block placed after the items list and before the submit
// buttons. Shows the editable freight and additional values plus the read-only
// products sum and the grand total (products + freight + additional), all in
// integer cents.
const SaleTotals = ({
  totalChargedCents,
  shippingValue,
  shippingValueError,
  additionalValue,
  additionalValueError,
  onChangeField,
}) => {
  const shippingCents =
    shippingValue === '' || shippingValue == null
      ? 0
      : toCents(parseFloat(shippingValue));
  const additionalCents =
    additionalValue === '' || additionalValue == null
      ? 0
      : toCents(parseFloat(additionalValue));
  const totalCents = totalChargedCents + shippingCents + additionalCents;

  return (
    <div className="mb-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-base rounded-md p-3">
          <label
            htmlFor="saleShippingValue"
            className="block text-xs text-ink-faint"
          >
            Frete (R$)
          </label>
          <CurrencyInput
            id="saleShippingValue"
            data-testid="sale-freight"
            value={shippingValue}
            onChange={(e) => onChangeField('shippingValue', e.target.value)}
            className="mt-1 text-sm"
          />
          {shippingValueError && (
            <div
              data-testid="sale-freight-error"
              className="mt-1 p-2 bg-danger-soft rounded-md"
            >
              <p className="text-sm text-danger-fg">{shippingValueError}</p>
            </div>
          )}
        </div>
        <div className="bg-base rounded-md p-3">
          <label
            htmlFor="saleAdditionalValue"
            className="block text-xs text-ink-faint"
          >
            Valores Adicionais (R$)
          </label>
          <CurrencyInput
            id="saleAdditionalValue"
            data-testid="sale-additional"
            value={additionalValue}
            onChange={(e) => onChangeField('additionalValue', e.target.value)}
            className="mt-1 text-sm"
          />
          {additionalValueError && (
            <div
              data-testid="sale-additional-error"
              className="mt-1 p-2 bg-danger-soft rounded-md"
            >
              <p className="text-sm text-danger-fg">{additionalValueError}</p>
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-base rounded-md p-3">
          <div className="text-xs text-ink-faint">
            Soma dos Produtos (Valor Cobrado)
          </div>
          <div
            data-testid="sale-totals-charged-footer"
            className="text-lg font-medium text-ink"
          >
            {formatBRL(fromCents(totalChargedCents))}
          </div>
        </div>
        <div className="bg-accent-soft rounded-md p-3">
          <div className="text-xs text-ink-faint">
            Total da Venda (produtos + frete + adicionais)
          </div>
          <div
            data-testid="sale-totals-total"
            className="text-lg font-semibold text-accent-on-soft"
          >
            {formatBRL(fromCents(totalCents))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaleTotals;
