import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreditCardsPage from '../src/pages/CreditCardsPage';
import { ToastProvider } from '../src/components/Toast';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('../src/services/api', () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    put: (...args) => mockPut(...args),
    delete: (...args) => mockDelete(...args),
  },
}));

const installment = (id, number, total, isEffective) => ({
  id,
  type: 'DESPESA',
  origin: 'CARTAO_CREDITO',
  amount: '100.00',
  description: 'Compra de teste',
  transactionDate: '2026-09-15T00:00:00.000Z',
  isEffective,
  effectiveDate: isEffective ? '2026-09-15T00:00:00.000Z' : null,
  installmentNumber: number,
  installmentsTotal: total,
  paymentType: 'CARTAO_CREDITO',
  creditCardBillId: 'bill-1',
});

const bill = (overrides = {}) => ({
  id: 'bill-1',
  description: 'Compra de teste',
  totalCents: 30000,
  installments: 3,
  firstInstallmentAt: '2026-09-15T00:00:00.000Z',
  brand: null,
  notes: null,
  categoryId: null,
  paymentType: 'CARTAO_CREDITO',
  transactions: [
    installment('inst-1', 1, 3, false),
    installment('inst-2', 2, 3, false),
    installment('inst-3', 3, 3, false),
  ],
  ...overrides,
});

const paidBill = bill({
  id: 'bill-2',
  description: 'Fatura paga',
  transactions: [installment('inst-4', 1, 1, true)],
  installments: 1,
});

const mockBills = (rows) => {
  mockGet.mockImplementation((url) => {
    if (url === '/credit-cards/bills') return Promise.resolve({ data: rows });
    return Promise.resolve({ data: [] });
  });
};

const LocationProbe = () => {
  const location = useLocation();
  return (
    <span data-testid="location">{`${location.pathname}${location.search}`}</span>
  );
};

const renderPage = (initialEntry = '/credit-cards') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ToastProvider>
        <Routes>
          <Route
            path="/credit-cards"
            element={
              <>
                <CreditCardsPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );

const waitForBills = async () => {
  await waitFor(() =>
    expect(screen.getByText('Compra de teste')).toBeInTheDocument(),
  );
};

describe('CreditCardsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the empty state when the user has no bills', async () => {
    mockBills([]);
    renderPage();

    expect(
      await screen.findByText('Nenhuma compra cadastrada'),
    ).toBeInTheDocument();
  });

  it('lists bills with total, paid installments, date and status badge', async () => {
    mockBills([bill()]);
    renderPage();
    await waitForBills();

    expect(screen.getByText('Cartões de crédito')).toBeInTheDocument();
    expect(screen.getByTestId('bill-total-bill-1')).toHaveTextContent(/300,00/);
    expect(screen.getByText('Parcelas 0/3 pagas')).toBeInTheDocument();
    expect(screen.getByText('15/09/2026')).toBeInTheDocument();
    expect(screen.getByTestId('bill-status-bill-1')).toHaveTextContent(
      'Aberta',
    );
  });

  it('opens the bill detail with the installment list when a row is clicked', async () => {
    mockBills([bill()]);
    renderPage();
    await waitForBills();

    fireEvent.click(screen.getByText('Compra de teste'));

    expect(await screen.findByTestId('installment-inst-1')).toHaveTextContent(
      'Parcela 1/3',
    );
    expect(screen.getByTestId('installment-inst-2')).toBeInTheDocument();
    expect(screen.getByTestId('installment-inst-3')).toBeInTheDocument();
  });

  it('optimistically marks an installment as paid', async () => {
    mockBills([bill()]);
    mockPost.mockResolvedValue({
      data: { ...installment('inst-1', 1, 3, true), id: 'inst-1' },
    });
    renderPage();
    await waitForBills();

    fireEvent.click(screen.getByText('Compra de teste'));
    fireEvent.click(await screen.findByTestId('installment-pay-inst-1'));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/credit-cards/installments/inst-1/pay',
        { paidAt: expect.any(String) },
      ),
    );
    expect(
      await screen.findByTestId('installment-unpay-inst-1'),
    ).toBeInTheDocument();
  });

  it('reverts an installment back to pending', async () => {
    mockBills([bill({ transactions: [installment('inst-1', 1, 1, true)] })]);
    mockPost.mockResolvedValue({
      data: { ...installment('inst-1', 1, 1, false), id: 'inst-1' },
    });
    renderPage();
    await waitForBills();

    fireEvent.click(screen.getByText('Compra de teste'));
    fireEvent.click(await screen.findByTestId('installment-unpay-inst-1'));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/credit-cards/installments/inst-1/unpay',
      ),
    );
  });

  it('opens the edit modal pre-filled and saves the metadata', async () => {
    mockBills([bill()]);
    mockPut.mockResolvedValue({
      data: bill({ description: 'Fatura editada' }),
    });
    renderPage();
    await waitForBills();

    fireEvent.click(screen.getByTestId('bill-actions-bill-1-trigger'));
    fireEvent.click(screen.getByTestId('bill-actions-bill-1-item-Editar'));

    const modal = await screen.findByTestId('bill-form-modal');
    expect(within(modal).getByLabelText('Descrição')).toHaveValue(
      'Compra de teste',
    );

    fireEvent.change(within(modal).getByLabelText('Descrição'), {
      target: { value: 'Fatura editada' },
    });
    fireEvent.submit(within(modal).getByLabelText('Descrição').closest('form'));

    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith('/credit-cards/bills/bill-1', {
        description: 'Fatura editada',
        totalAmount: 300,
        installments: 3,
        firstInstallmentAt: '2026-09-15',
        brand: null,
        notes: null,
      }),
    );
  });

  it('opens the new bill modal from the toolbar button', async () => {
    mockBills([paidBill]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Fatura paga')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Nova compra' }));

    expect(await screen.findByTestId('bill-form-modal')).toBeInTheDocument();
    expect(
      screen.getByText('Nova compra', { selector: 'h3' }),
    ).toBeInTheDocument();
  });

  it('surfaces an unknown deep-linked bill as a toast and leaves the query', async () => {
    mockBills([bill()]);
    renderPage('/credit-cards?bill=foreign-bill');

    expect(
      await screen.findByText('Compra não encontrada.'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/credit-cards'),
    );
    expect(screen.getByTestId('location')).not.toHaveTextContent(
      'foreign-bill',
    );
  });

  it('opens the OFX import modal from the toolbar', async () => {
    mockBills([bill()]);
    renderPage();
    await waitForBills();

    fireEvent.click(screen.getByRole('button', { name: /Conciliar fatura/ }));

    expect(
      await screen.findByTestId('credit-card-reconcile-modal'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('credit-card-reconcile-file-input'),
    ).toBeInTheDocument();
  });
});
