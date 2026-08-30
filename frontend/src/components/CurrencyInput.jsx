import { NumberFormatBase } from 'react-number-format';
import {
  canonicalCurrencyFromDigits,
  currencyDigitsFromRaw,
  digitsFromCurrencyValue,
  maskedCurrencyFromDigits,
} from '../utils/currencyMask';

const BASE_CLASS =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors';

export default function CurrencyInput({
  value,
  onChange,
  id,
  name,
  placeholder = '',
  disabled = false,
  required = false,
  className = '',
  'data-testid': dataTestId,
}) {
  const handleValueChange = ({ value: digits }) => {
    onChange({ target: { name, value: canonicalCurrencyFromDigits(digits) } });
  };

  const classes = `${BASE_CLASS}${disabled ? ' disabled:opacity-50 disabled:cursor-not-allowed' : ''}${className ? ` ${className}` : ''}`;

  return (
    <NumberFormatBase
      id={id}
      name={name}
      value={digitsFromCurrencyValue(value)}
      valueIsNumericString
      format={maskedCurrencyFromDigits}
      removeFormatting={currencyDigitsFromRaw}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      data-testid={dataTestId}
      className={classes}
      onValueChange={handleValueChange}
    />
  );
}
