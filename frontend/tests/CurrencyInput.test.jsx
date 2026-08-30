import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CurrencyInput from '../src/components/CurrencyInput';

describe('CurrencyInput', () => {
  it('renders with an empty placeholder by default', () => {
    render(<CurrencyInput name="amount" value="" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', '');
  });

  it('accepts a custom placeholder', () => {
    render(
      <CurrencyInput
        name="amount"
        value=""
        onChange={vi.fn()}
        placeholder="0,00"
      />,
    );
    expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', '0,00');
  });

  it('masks typed digits as cents and emits a canonical dot-decimal value', () => {
    const onChange = vi.fn();
    render(<CurrencyInput name="amount" value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '1234' } });
    expect(input.value).toBe('12,34');
    expect(onChange).toHaveBeenCalledWith({
      target: { name: 'amount', value: '12.34' },
    });
  });

  it('displays a prefilled value formatted as BRL', () => {
    render(<CurrencyInput name="amount" value="100" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveValue('100,00');
  });

  it('displays a prefilled decimal value formatted as BRL', () => {
    render(<CurrencyInput name="amount" value="12.5" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveValue('12,50');
  });

  it('emits empty string when cleared', () => {
    const onChange = vi.fn();
    render(<CurrencyInput name="amount" value="12.34" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');
    expect(onChange).toHaveBeenCalledWith({
      target: { name: 'amount', value: '' },
    });
  });

  it('strips non-digit characters such as the minus sign', () => {
    const onChange = vi.fn();
    render(<CurrencyInput name="amount" value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '-5' } });
    expect(input.value).toBe('0,05');
    expect(onChange).toHaveBeenCalledWith({
      target: { name: 'amount', value: '0.05' },
    });
  });

  it('ignores digits beyond the 10-digit cap', () => {
    const onChange = vi.fn();
    render(<CurrencyInput name="amount" value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '12345678901' } });
    expect(input.value).toBe('12.345.678,90');
    expect(onChange).toHaveBeenCalledWith({
      target: { name: 'amount', value: '12345678.9' },
    });
  });

  it('supports disabled and passes through testid and name', () => {
    render(
      <CurrencyInput
        name="amount"
        value="0"
        onChange={vi.fn()}
        disabled
        data-testid="payment-amount"
      />,
    );
    const input = screen.getByTestId('payment-amount');
    expect(input).toBeDisabled();
    expect(input).toHaveValue('0,00');
    expect(input).toHaveAttribute('name', 'amount');
  });
});
