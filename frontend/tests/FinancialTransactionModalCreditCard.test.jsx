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
});

const Harness = ({ onClose = vi.fn() }) => {
  const [simpleForm] = useState(emptySimpleForm);
  const card = useCreditCardBillForm();
  return (
    <FinancialTransactionModal
      isOpen
      onClose={onClose}
      form={simpleForm}
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
});
