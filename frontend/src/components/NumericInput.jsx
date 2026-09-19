import React from 'react';

const BASE_CLASS =
  'px-3 py-2 border border-line bg-surface text-ink rounded-md shadow-sm placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors disabled:bg-base disabled:text-ink-faint disabled:cursor-not-allowed';

// Integer fields keep digits only, so signs, decimals and letters never reach
// the application state.
export function sanitizeIntegerInput(raw) {
  return String(raw ?? '').replace(/\D/g, '');
}

// Decimal fields keep digits and a single decimal separator. A comma is
// normalized to a dot so Brazilian typing feeds the same canonical format the
// forms already persist.
export function sanitizeDecimalInput(raw) {
  const cleaned = String(raw ?? '')
    .replace(/[^\d.,]/g, '')
    .replace(/,/g, '.');
  const separatorIndex = cleaned.indexOf('.');
  if (separatorIndex === -1) return cleaned;
  const integerPart = cleaned.slice(0, separatorIndex);
  const decimalPart = cleaned.slice(separatorIndex + 1).replace(/\./g, '');
  return `${integerPart}.${decimalPart}`;
}

// Optional upper bound: values above the limit are clamped so the field can
// never hold a number outside the allowed range while typing.
export function clampToMax(value, max) {
  if (max === undefined || max === null || value === '') return value;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= max) return value;
  return String(max);
}

// Text input with numeric semantics: no native spinner arrows, while every
// change is sanitized to digits (and optionally a decimal separator). It
// reports the sanitized value through the same `onChange` shape as a native
// input so existing handlers keep working unchanged.
export default function NumericInput({
  value,
  onChange,
  id,
  name,
  placeholder = '',
  disabled = false,
  required = false,
  decimal = false,
  max,
  className = '',
  'data-testid': dataTestId,
  'aria-label': ariaLabel,
}) {
  const handleChange = (event) => {
    const sanitized = decimal
      ? sanitizeDecimalInput(event.target.value)
      : sanitizeIntegerInput(event.target.value);
    onChange({ target: { name, value: clampToMax(sanitized, max) } });
  };

  const classes = `${BASE_CLASS}${className ? ` ${className}` : ''}`;

  return (
    <input
      id={id}
      name={name}
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      autoComplete="off"
      value={value === null || value === undefined ? '' : value}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      data-testid={dataTestId}
      aria-label={ariaLabel}
      className={classes}
    />
  );
}
