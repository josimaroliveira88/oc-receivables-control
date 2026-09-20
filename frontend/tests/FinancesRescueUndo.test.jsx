import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FinancesPage from '../src/pages/FinancesPage';
import { ToastProvider } from '../src/components/Toast';

const mockGet = vi.fn();
const mockDelete = vi.fn();

vi.mock('../src/services/api', () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: vi.fn(),
    put: vi.fn(),
    delete: (...args) => mockDelete(...args),
  },
}));

const rescueTransaction = {
  id: 't-resgate',
  type: 'RECEITA',
  origin: 'RESGATE_INFINITEPAY',
  amount: '220.01',
  description: 'Resgate InfinitePay — Venda V-0001',
  transactionDate: '2026-09-16T00:00:00.000Z',
  notes: null,
  categoryId: 'cat-vendas',
  category: { id: 'cat-vendas', name: 'Vendas', type: 'RECEITA' },
  orderId: 'order-1',
  paymentId: null,
  feeAmount: null,
};

const manualTransaction = {
  id: 't-manual',
  type: 'RECEITA',
  origin: 'MANUAL',
  amount: '80.00',
  description: 'Bônus dōTERRA',
  transactionDate: '2026-09-12T00:00:00.000Z',
  notes: null,
  categoryId: 'cat-vendas',
  category: { id: 'cat-vendas', name: 'Vendas', type: 'RECEITA' },
  orderId: null,
  paymentId: null,
  feeAmount: null,
};

const summary = {
  totalIncome: '300.01',
  totalExpense: '0.00',
  balance: '300.01',
};

const mockGetImplementation = () => {
  mockGet.mockImplementation((url) => {
    if (url === '/finances/categories') return Promise.resolve({ data: [] });
    if (url === '/finances/transactions')
      return Promise.resolve({ data: [rescueTransaction, manualTransaction] });
    if (url === '/finances/summary') return Promise.resolve({ data: summary });
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

const openActionMenu = async (id) => {
  await waitFor(() =>
    expect(
      screen.getByTestId(`transaction-actions-${id}-trigger`),
    ).toBeInTheDocument(),
  );
  fireEvent.click(screen.getByTestId(`transaction-actions-${id}-trigger`));
};

describe('Undo an InfinitePay rescue from the finances page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers the undo action only for redemption rows', async () => {
    mockGetImplementation();
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByText('Resgate InfinitePay — Venda V-0001'),
      ).toBeInTheDocument(),
    );

    await openActionMenu('t-resgate');
    expect(
      screen.getByTestId('transaction-actions-t-resgate-item-Desfazer-resgate'),
    ).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });

    await openActionMenu('t-manual');
    expect(
      screen.getByTestId('transaction-actions-t-manual-item-Editar'),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId(
        'transaction-actions-t-manual-item-Desfazer-resgate',
      ),
    ).not.toBeInTheDocument();
  });

  it('asks for confirmation and undoes the redemption', async () => {
    mockDelete.mockResolvedValue({ data: { message: 'ok' } });
    mockGetImplementation();
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByText('Resgate InfinitePay — Venda V-0001'),
      ).toBeInTheDocument(),
    );

    await openActionMenu('t-resgate');
    fireEvent.click(
      screen.getByTestId('transaction-actions-t-resgate-item-Desfazer-resgate'),
    );

    const confirmButtons = await screen.findAllByRole('button', {
      name: 'Desfazer resgate',
    });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() =>
      expect(mockDelete).toHaveBeenCalledWith(
        '/finances/settlements/t-resgate',
      ),
    );
  });

  it('does not call the API when the confirmation is cancelled', async () => {
    mockGetImplementation();
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByText('Resgate InfinitePay — Venda V-0001'),
      ).toBeInTheDocument(),
    );

    await openActionMenu('t-resgate');
    fireEvent.click(
      screen.getByTestId('transaction-actions-t-resgate-item-Desfazer-resgate'),
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
