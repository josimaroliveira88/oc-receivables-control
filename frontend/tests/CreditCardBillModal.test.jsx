import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCreditCards } from '../src/pages/CreditCards/useCreditCards';
import CreditCardBillModal from '../src/pages/CreditCards/components/CreditCardBillModal';
import { ToastProvider } from '../src/components/Toast';

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('../src/services/api', () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
  },
}));

const Harness = () => {
  const cards = useCreditCards();
  return (
    <>
      <button type="button" onClick={cards.openBillCreate}>
        Abrir nova
      </button>
      <CreditCardBillModal
        isOpen={cards.showBillForm}
        onClose={cards.closeBillForm}
        form={cards.billForm}
        formError={cards.billFormError}
        submitting={cards.billSubmitting}
        isDirty={cards.billFormDirty}
        onChangeField={cards.setBillField}
        onSubmit={cards.handleBillSubmit}
      />
    </>
  );
};

const renderModal = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <Harness />
      </ToastProvider>
    </MemoryRouter>,
  );

const openModal = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Abrir nova' }));
  return screen.findByTestId('bill-form-modal');
};

const fillValidForm = ({ modal, total = '3550' }) => {
  fireEvent.change(screen.getByLabelText('Descrição'), {
    target: { value: 'Compra de teste' },
  });
  fireEvent.change(screen.getByTestId('bill-total-amount'), {
    target: { value: total },
  });
  fireEvent.change(screen.getByLabelText('Primeira parcela'), {
    target: { value: '2026-09-15' },
  });
  return within(modal).getByLabelText('Descrição').closest('form');
};

describe('CreditCardBillModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ data: [] });
  });

  it('renders with installments = 1 (à vista) by default', async () => {
    renderModal();
    await openModal();

    expect(screen.getByLabelText('Parcelas')).toHaveValue(1);
  });

  it('keeps the first installment date visible and required for N > 1', async () => {
    renderModal();
    await openModal();

    fireEvent.change(screen.getByLabelText('Parcelas'), {
      target: { value: '3' },
    });

    const dateInput = screen.getByLabelText('Primeira parcela');
    expect(dateInput).toBeVisible();
    expect(dateInput).toHaveAttribute('required');
  });

  it('shows a validation error and does not POST when the amount is zero', async () => {
    renderModal();
    const modal = await openModal();

    const form = fillValidForm({ modal, total: '' });
    fireEvent.submit(form);

    expect(await screen.findByTestId('bill-form-error')).toHaveTextContent(
      'Informe um valor maior que zero',
    );
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('posts a valid form and closes the modal on success', async () => {
    mockPost.mockResolvedValue({ data: { id: 'bill-1' } });
    renderModal();
    const modal = await openModal();

    const form = fillValidForm({ modal });
    fireEvent.submit(form);

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/credit-cards/bills', {
        description: 'Compra de teste',
        totalAmount: 35.5,
        installments: 1,
        firstInstallmentAt: '2026-09-15',
        brand: null,
        notes: null,
      }),
    );
    await waitFor(() =>
      expect(screen.queryByTestId('bill-form-modal')).not.toBeInTheDocument(),
    );
  });

  it('asks to discard before closing with unsaved changes', async () => {
    renderModal();
    await openModal();

    fireEvent.change(screen.getByLabelText('Descrição'), {
      target: { value: 'rascunho' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(
      await screen.findByText('Descartar alterações?'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    await waitFor(() =>
      expect(screen.queryByTestId('bill-form-modal')).not.toBeInTheDocument(),
    );

    await openModal();
    fireEvent.change(screen.getByLabelText('Descrição'), {
      target: { value: 'rascunho 2' },
    });
    fireEvent.mouseDown(screen.getByTestId('bill-form-modal'));
    expect(
      await screen.findByText('Descartar alterações?'),
    ).toBeInTheDocument();
  });
});
