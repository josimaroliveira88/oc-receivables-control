import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FinancesPage from '../src/pages/FinancesPage';
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

const RouteProbe = () => {
  const location = useLocation();
  return (
    <div data-testid="route-probe">{location.pathname + location.search}</div>
  );
};

const categories = [
  {
    id: 'cat-vendas',
    name: 'Vendas',
    type: 'RECEITA',
    isDefault: true,
    active: true,
  },
];

const linkedTransaction = {
  id: 'tx-1',
  type: 'RECEITA',
  origin: 'VENDA',
  amount: '200.00',
  description: 'Venda V-0002 — João Silva',
  transactionDate: '2026-09-10T00:00:00.000Z',
  notes: null,
  isEffective: true,
  installmentNumber: null,
  installmentsTotal: null,
  paymentType: null,
  feeAmount: null,
  categoryId: 'cat-vendas',
  category: { id: 'cat-vendas', name: 'Vendas', type: 'RECEITA' },
  orderId: 'order-1',
};

const otherTransaction = {
  ...linkedTransaction,
  id: 'tx-2',
  description: 'Bônus dōTERRA',
  orderId: null,
};

const mockGetImplementation = (rows = [linkedTransaction]) => {
  mockGet.mockImplementation((url) => {
    if (url === '/finances/categories')
      return Promise.resolve({ data: categories });
    if (url === '/finances/transactions')
      return Promise.resolve({ data: rows });
    if (url === '/finances/summary')
      return Promise.resolve({
        data: { totalIncome: '0.00', totalExpense: '0.00', balance: '0.00' },
      });
    return Promise.resolve({ data: [] });
  });
};

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <FinancesPage />
        <RouteProbe />
      </ToastProvider>
    </MemoryRouter>,
  );

const waitForTable = async () => {
  await waitFor(() =>
    expect(
      screen.getAllByText('Venda V-0002 — João Silva').length,
    ).toBeGreaterThan(0),
  );
};

// The last `GET /finances/transactions` call, regardless of the summary call
// that fires alongside it.
const lastTransactionsCall = () => {
  const calls = mockGet.mock.calls.filter(
    ([url]) => url === '/finances/transactions',
  );
  return calls[calls.length - 1];
};

describe('Finances deep links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('orderId filter', () => {
    it('sends the orderId from the URL to the list and the summary', async () => {
      mockGetImplementation();
      renderAt('/finances?orderId=order-1');
      await waitForTable();

      expect(mockGet).toHaveBeenCalledWith('/finances/transactions', {
        params: { orderId: 'order-1' },
      });
      expect(mockGet).toHaveBeenCalledWith('/finances/summary', {
        params: { orderId: 'order-1' },
      });
      expect(screen.getByTestId('finances-order-filter')).toBeInTheDocument();
    });

    it('does not send an orderId param on a plain visit', async () => {
      mockGetImplementation();
      renderAt('/finances');
      await waitForTable();

      expect(mockGet).toHaveBeenCalledWith('/finances/transactions', {
        params: {},
      });
      expect(
        screen.queryByTestId('finances-order-filter'),
      ).not.toBeInTheDocument();
    });

    it('drops the orderId filter through the chip button', async () => {
      mockGetImplementation([linkedTransaction, otherTransaction]);
      renderAt('/finances?orderId=order-1');
      await waitForTable();

      fireEvent.click(screen.getByTestId('finances-order-filter-clear'));

      await waitFor(() =>
        expect(lastTransactionsCall()).toEqual([
          '/finances/transactions',
          { params: {} },
        ]),
      );
      expect(
        screen.queryByTestId('finances-order-filter'),
      ).not.toBeInTheDocument();
      expect(screen.getByText('Bônus dōTERRA')).toBeInTheDocument();
      expect(screen.getByTestId('route-probe')).toHaveTextContent('/finances');
    });

    it('drops the orderId filter through the toolbar Limpar button', async () => {
      mockGetImplementation([linkedTransaction, otherTransaction]);
      renderAt('/finances?orderId=order-1');
      await waitForTable();

      fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));

      await waitFor(() =>
        expect(lastTransactionsCall()).toEqual([
          '/finances/transactions',
          { params: {} },
        ]),
      );
      expect(screen.getByText('Bônus dōTERRA')).toBeInTheDocument();
    });
  });

  describe('transactionId deep link', () => {
    it('opens the read-only details modal of the referenced transaction', async () => {
      mockGetImplementation();
      renderAt('/finances?orderId=order-1&transactionId=tx-1');
      await waitForTable();

      await waitFor(() =>
        expect(
          screen.getByTestId('transaction-details-modal'),
        ).toBeInTheDocument(),
      );
      const modal = within(screen.getByTestId('transaction-details-modal'));
      expect(modal.getByText('Detalhamento do lançamento')).toBeInTheDocument();
      expect(
        modal.getByTestId('transaction-details-description'),
      ).toHaveTextContent('Venda V-0002 — João Silva');
      expect(screen.queryByText('Editar lançamento')).not.toBeInTheDocument();
    });

    it('clears the transactionId param when the modal is closed', async () => {
      mockGetImplementation();
      renderAt('/finances?orderId=order-1&transactionId=tx-1');
      await waitForTable();

      const modal = await screen.findByTestId('transaction-details-modal');
      fireEvent.click(
        within(modal).getByRole('button', { name: 'Fechar detalhamento' }),
      );

      await waitFor(() =>
        expect(
          screen.queryByTestId('transaction-details-modal'),
        ).not.toBeInTheDocument(),
      );
      expect(screen.getByTestId('route-probe')).toHaveTextContent(
        '/finances?orderId=order-1',
      );
    });

    it('ignores a transactionId that is not in the loaded rows', async () => {
      mockGetImplementation();
      renderAt('/finances?orderId=order-1&transactionId=missing');
      await waitForTable();

      await waitFor(() =>
        expect(screen.getByTestId('route-probe')).toHaveTextContent(
          '/finances?orderId=order-1',
        ),
      );
      expect(
        screen.queryByTestId('transaction-details-modal'),
      ).not.toBeInTheDocument();
    });
  });

  describe('details from the table action menu', () => {
    const openDetailsViaMenu = async (id) => {
      fireEvent.click(screen.getByTestId(`transaction-actions-${id}-trigger`));
      fireEvent.click(
        screen.getByTestId(`transaction-actions-${id}-item-Ver-detalhes`),
      );
      await screen.findByTestId('transaction-details-modal');
    };

    it('opens the details modal for a linked sale row', async () => {
      mockGetImplementation();
      renderAt('/finances');
      await waitForTable();

      await openDetailsViaMenu('tx-1');

      const modal = within(screen.getByTestId('transaction-details-modal'));
      expect(modal.getByText('Detalhamento do lançamento')).toBeInTheDocument();
      expect(
        modal.getByTestId('transaction-details-description'),
      ).toHaveTextContent('Venda V-0002 — João Silva');
    });

    it('opens the details modal for a manual row and mirrors the id in the URL', async () => {
      mockGetImplementation([linkedTransaction, otherTransaction]);
      renderAt('/finances');
      await waitForTable();

      await openDetailsViaMenu('tx-2');

      const modal = within(screen.getByTestId('transaction-details-modal'));
      expect(
        modal.getByTestId('transaction-details-description'),
      ).toHaveTextContent('Bônus dōTERRA');
      expect(screen.getByTestId('route-probe')).toHaveTextContent(
        '/finances?transactionId=tx-2',
      );
    });

    it('clears the param and closes the modal opened by the action menu', async () => {
      mockGetImplementation([linkedTransaction, otherTransaction]);
      renderAt('/finances');
      await waitForTable();

      await openDetailsViaMenu('tx-2');
      fireEvent.click(
        within(screen.getByTestId('transaction-details-modal')).getByRole(
          'button',
          { name: 'Fechar detalhamento' },
        ),
      );

      await waitFor(() =>
        expect(
          screen.queryByTestId('transaction-details-modal'),
        ).not.toBeInTheDocument(),
      );
      expect(screen.getByTestId('route-probe')).toHaveTextContent('/finances');
    });
  });
});
