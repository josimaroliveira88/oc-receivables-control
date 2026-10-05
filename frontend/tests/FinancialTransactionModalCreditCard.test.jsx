/* eslint-disable react/prop-types */
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FinancialTransactionModal from '../src/pages/Finances/components/FinancialTransactionModal';
import { useCreditCardBillForm } from '../src/hooks/useCreditCardBillForm';
import { ToastProvider } from '../src/components/Toast';

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('../src/services/api', () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    put: () => vi.fn(),
    delete: () => vi.fn(),
  },
}));

const emptySimpleForm = () => ({
  id: null,
  type: 'DESPESA',
  amount: '',
  description: '',
  transactionDate: '',
  categoryId: '',
  notes: '',
  paymentType: null,
  effectiveDate: '',
});

const Harness = ({ onClose = vi.fn(), form, mode }) => {
  const [simpleForm] = useState(form ?? emptySimpleForm);
  const card = useCreditCardBillForm();
  return (
    <FinancialTransactionModal
      isOpen
      onClose={onClose}
      form={simpleForm}
      mode={mode}
      categories={[]}
      isDirty={false}
      onChangeField={vi.fn()}
      onSubmit={vi.fn()}
      creditCard={{
        form: card.form,
        formError: card.formError,
        submitting: card.submitting,
        isDirty: card.isDirty,
        onChangeField: card.setField,
        onSubmit: card.handleSubmit,
      }}
    />
  );
};

const renderModal = (props) =>
  render(
    <ToastProvider>
      <Harness {...props} />
    </ToastProvider>,
  );

describe('FinancialTransactionModal credit-card branch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ data: [] });
  });

  it('opens with the simple entry tab by default', () => {
    renderModal();

    expect(
      screen.getByRole('button', { name: 'Lançamento simples' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Tipo')).toBeInTheDocument();
    expect(screen.queryByLabelText('Parcelas')).not.toBeInTheDocument();
  });

  it('replaces the form with the credit-card fields when switched', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Cartão de crédito' }));

    expect(screen.getByLabelText('Parcelas')).toBeInTheDocument();
    expect(screen.getByLabelText('Primeira parcela')).toBeInTheDocument();
    expect(screen.queryByLabelText('Tipo')).not.toBeInTheDocument();
  });

  it('routes the credit-card cancel through the polite-close guard', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Cartão de crédito' }));
    fireEvent.change(screen.getByLabelText('Descrição'), {
      target: { value: 'rascunho' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.getByText('Descartar alterações?')).toBeInTheDocument();
  });

  it('does not offer the credit-card tab when editing a manual entry', () => {
    renderModal({ mode: 'manual', form: { ...emptySimpleForm(), id: 't-1' } });

    expect(
      screen.queryByRole('button', { name: 'Cartão de crédito' }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Tipo')).toBeInTheDocument();
  });

  it('converts an Uber entry from the credit-card tab without creating a bill', () => {
    renderModal({
      mode: 'uber',
      form: { ...emptySimpleForm(), id: 't-2', amount: '32.93' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cartão de crédito' }));

    expect(screen.getByLabelText('Data da fatura')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Data do lançamento no cartão'),
    ).toBeInTheDocument();
    // The bill form (create-only) is never rendered while editing.
    expect(screen.queryByLabelText('Parcelas')).not.toBeInTheDocument();
  });
});
