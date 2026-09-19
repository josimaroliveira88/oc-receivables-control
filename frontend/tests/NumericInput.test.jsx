import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NumericInput, {
  sanitizeIntegerInput,
  sanitizeDecimalInput,
  clampToMax,
} from '../src/components/NumericInput';

describe('sanitizeIntegerInput', () => {
  it('keeps digits only', () => {
    expect(sanitizeIntegerInput('12abc34')).toBe('1234');
    expect(sanitizeIntegerInput('-5')).toBe('5');
    expect(sanitizeIntegerInput('1.5')).toBe('15');
    expect(sanitizeIntegerInput('')).toBe('');
    expect(sanitizeIntegerInput(null)).toBe('');
  });
});

describe('sanitizeDecimalInput', () => {
  it('keeps a single decimal separator and normalizes commas', () => {
    expect(sanitizeDecimalInput('46.5')).toBe('46.5');
    expect(sanitizeDecimalInput('46,5')).toBe('46.5');
    expect(sanitizeDecimalInput('1.2.3')).toBe('1.23');
    expect(sanitizeDecimalInput('-3,75')).toBe('3.75');
    expect(sanitizeDecimalInput('abc')).toBe('');
  });
});

describe('clampToMax', () => {
  it('keeps values within the limit untouched', () => {
    expect(clampToMax('0', 100)).toBe('0');
    expect(clampToMax('50', 100)).toBe('50');
    expect(clampToMax('100', 100)).toBe('100');
    expect(clampToMax('', 100)).toBe('');
  });

  it('clamps values above the limit', () => {
    expect(clampToMax('101', 100)).toBe('100');
    expect(clampToMax('150', 100)).toBe('100');
    expect(clampToMax('999', 100)).toBe('100');
  });

  it('is a no-op when no limit is provided', () => {
    expect(clampToMax('150', undefined)).toBe('150');
    expect(clampToMax('150', null)).toBe('150');
  });
});

describe('NumericInput', () => {
  it('renders a text input without native number spinners', () => {
    render(<NumericInput name="quantity" value={1} onChange={vi.fn()} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveValue('1');
  });

  it('uses the decimal inputmode when decimal is enabled', () => {
    render(<NumericInput name="pv" value="" onChange={vi.fn()} decimal />);
    expect(screen.getByRole('textbox')).toHaveAttribute('inputmode', 'decimal');
  });

  it('strips non-numeric characters and reports the sanitized value', () => {
    const onChange = vi.fn();
    render(<NumericInput name="quantity" value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '2a' },
    });
    expect(onChange).toHaveBeenCalledWith({
      target: { name: 'quantity', value: '2' },
    });
  });

  it('clamps the reported value to the configured maximum', () => {
    const onChange = vi.fn();
    render(
      <NumericInput name="discount" value="" onChange={onChange} max={100} />,
    );
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '150' },
    });
    expect(onChange).toHaveBeenCalledWith({
      target: { name: 'discount', value: '100' },
    });
  });

  it('ignores a minus sign so the value cannot go negative', () => {
    const onChange = vi.fn();
    render(<NumericInput name="pv" value="" onChange={onChange} decimal />);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '-5' },
    });
    expect(onChange).toHaveBeenCalledWith({
      target: { name: 'pv', value: '5' },
    });
  });

  it('normalizes a typed comma to a dot in decimal mode', () => {
    const onChange = vi.fn();
    render(<NumericInput name="pv" value="" onChange={onChange} decimal />);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '46,5' },
    });
    expect(onChange).toHaveBeenCalledWith({
      target: { name: 'pv', value: '46.5' },
    });
  });

  it('passes through testid, aria-label and disabled state', () => {
    render(
      <NumericInput
        name="quantity"
        value=""
        onChange={vi.fn()}
        data-testid="numeric-field"
        aria-label="Quantidade"
        disabled
      />,
    );
    const input = screen.getByTestId('numeric-field');
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('aria-label', 'Quantidade');
  });
});
