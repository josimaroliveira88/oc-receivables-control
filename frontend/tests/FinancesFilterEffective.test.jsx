import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FinancesPage from '../src/pages/FinancesPage';
import { ToastProvider } from '../src/components/Toast';

const mockGet = vi.fn();

vi.mock('../src/services/api', () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => vi.fn(...args),
    put: () => vi.fn(),
    delete: () => vi.fn(),
  },
}));

const categories = [
  {
    id: 'cat-doterra',
    name: 'Compra de produtos dōTERRA',
    type: 'DESPESA',
    isDefault: true,
    active: true,
  },
];

const pendingRow = {
  id: 't-pending',
  type: 'DESPESA',
  origin: 'CARTAO_CREDITO',
  amount: '100.00',
  description: 'Compra no cartão pendente',
  transactionDate: '2026-09-15T00:00:00.000Z',
  isEffective: false,
  effectiveDate: null,
  installmentNumber: 1,
  installmentsTotal: 3,
  creditCardBillId: 'bill-1',
  paymentType: 'CARTAO_CREDITO',
  categoryId: 'cat-doterra',
  category: {
    id: 'cat-doterra',
    name: 'Compra de produtos dōTERRA',
    type: 'DESPESA',
  },
  orderId: null,
  paymentId: null,
  feeAmount: null,
};

const effectiveRow = {
  ...pendingRow,
  id: 't-effective',
  description: 'Compra no cartão efetiva',
  isEffective: true,
  effectiveDate: '2026-09-16T00:00:00.000Z',
};

const mockApi = () => {
  mockGet.mockImplementation((url, config) => {
    if (url === '/finances/categories')
      return Promise.resolve({ data: categories });
    if (url === '/finances/transactions') {
      const effective = config?.params?.effective;
      return Promise.resolve({
        data: effective === 'no' ? [pendingRow] : [pendingRow, effectiveRow],
      });
    }
    if (url === '/finances/summary') {
      return Promise.resolve({
        data: {
          totalIncome: '0.00',
          totalExpense: '100.00',
          balance: '-100.00',
          pendingTotal: '100.00',
        },
      });
    }
    return Promise.resolve({ data: [] });
  });
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <FinancesPage />
      </ToastProvider>
    </MemoryRouter>,
  );

const waitForTable = async () => {
  await waitFor(() =>
    expect(screen.getByText('Compra no cartão pendente')).toBeInTheDocument(),
  );
};

describe('Finances effectiveness filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers the Efetividade select with all three options', async () => {
    mockApi();
    renderPage();
    await waitForTable();

    const select = screen.getByLabelText('Efetividade');
    expect(select).toBeInTheDocument();
    expect(select).toHaveDisplayValue('Todas');
    expect(
      screen.getByRole('option', { name: 'Somente efetivas' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Somente pendentes' }),
    ).toBeInTheDocument();
  });

  it('refetches with effective=no and hides the effective rows', async () => {
    mockApi();
    renderPage();
    await waitForTable();

    fireEvent.change(screen.getByLabelText('Efetividade'), {
      target: { value: 'no' },
    });

    await waitFor(() => {
      const calls = mockGet.mock.calls.filter(
        ([url]) => url === '/finances/transactions',
      );
      expect(calls.at(-1)[1].params.effective).toBe('no');
    });

    await waitFor(() =>
      expect(
        screen.queryByText('Compra no cartão efetiva'),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Compra no cartão pendente')).toBeInTheDocument();
  });

  it('shows the pending total from the summary', async () => {
    mockApi();
    renderPage();
    await waitForTable();

    expect(screen.getByTestId('finances-summary-pending')).toHaveTextContent(
      /100,00/,
    );
  });

  it('shows the installment and effectiveness badges per row', async () => {
    mockApi();
    renderPage();
    await waitForTable();

    expect(
      screen.getByTestId('transaction-installment-t-pending'),
    ).toHaveTextContent('1/3');
    expect(
      screen.getByTestId('transaction-effectiveness-t-pending'),
    ).toHaveTextContent('Pendente');
    expect(
      screen.getByTestId('transaction-effectiveness-t-effective'),
    ).toHaveTextContent('Efetiva');
  });
});
