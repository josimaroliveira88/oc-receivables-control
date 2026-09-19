import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SalesPage from '../src/pages/SalesPage';
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

const infinitePaySale = {
  id: 'order-1',
  orderNumber: 'V-0001',
  orderDate: '2026-09-01',
  totalValue: '613.12',
  status: 'QUITADO',
  orderNotes: null,
  deliveredAt: null,
  items: [
    {
      id: 'i1',
      description: 'Adaptiv',
      chargedValue: '613.12',
      quantity: 1,
      chargedValueMode: 'UNIT',
      personId: 'p1',
      person: { name: 'João Silva' },
      productId: 'prod-1',
      product: { id: 'prod-1', name: 'Adaptiv', code: '1' },
    },
  ],
  payments: [
    {
      id: 'pay-1',
      paymentType: 'INFINITE_PAY',
      amount: '613.12',
      netAmount: '600.00',
      paidAt: '2026-09-02',
    },
  ],
};

const pixSale = {
  id: 'order-pix',
  orderNumber: 'V-0002',
  orderDate: '2026-09-03',
  totalValue: '50.00',
  status: 'QUITADO',
  orderNotes: null,
  deliveredAt: null,
  items: [
    {
      id: 'i2',
      description: 'Menta',
      chargedValue: '50.00',
      quantity: 1,
      chargedValueMode: 'UNIT',
      personId: 'p2',
      person: { name: 'Maria Santos' },
      productId: 'prod-2',
      product: { id: 'prod-2', name: 'Menta', code: '2' },
    },
  ],
  payments: [
    {
      id: 'pay-2',
      paymentType: 'PIX',
      amount: '50.00',
      netAmount: '50.00',
      paidAt: '2026-09-03',
    },
  ],
};

const mockGetImplementation = (salesRows = [infinitePaySale, pixSale]) => {
  mockGet.mockImplementation((url) => {
    if (url === '/sales') return Promise.resolve({ data: salesRows });
    if (url === '/people') return Promise.resolve({ data: [] });
    if (url.startsWith('/products'))
      return Promise.resolve({ data: { data: [] } });
    if (url === '/finances/transactions') return Promise.resolve({ data: [] });
    return Promise.resolve({ data: [] });
  });
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <SalesPage />
      </ToastProvider>
    </MemoryRouter>,
  );

const openSaleActionsMenu = async (saleId) => {
  await waitFor(() =>
    expect(
      screen.getByTestId(`sale-actions-${saleId}-trigger`),
    ).toBeInTheDocument(),
  );
  fireEvent.click(screen.getByTestId(`sale-actions-${saleId}-trigger`));
  await waitFor(() =>
    expect(
      screen.getByTestId(`sale-actions-${saleId}-menu`),
    ).toBeInTheDocument(),
  );
};

const clickSaleAction = async (saleId, label) => {
  await openSaleActionsMenu(saleId);
  fireEvent.click(screen.getByTestId(`sale-actions-${saleId}-item-${label}`));
};

describe('InfinitePay settlement from the Sales page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers the redemption action only for sales with an InfinitePay payment', async () => {
    mockGetImplementation();
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('João Silva')).toBeInTheDocument(),
    );

    await openSaleActionsMenu('order-1');
    expect(
      screen.getByTestId(
        'sale-actions-order-1-item-Registrar-resgate-InfinitePay',
      ),
    ).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });

    await openSaleActionsMenu('order-pix');
    expect(
      screen.queryByTestId(
        'sale-actions-order-pix-item-Registrar-resgate-InfinitePay',
      ),
    ).not.toBeInTheDocument();
  });

  it('registers a redemption and refreshes the sales list', async () => {
    mockPost.mockResolvedValue({
      data: { id: 't-resgate', amount: '613.12' },
    });
    mockGetImplementation();
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('João Silva')).toBeInTheDocument(),
    );

    await clickSaleAction('order-1', 'Registrar-resgate-InfinitePay');
    await screen.findByText('Registrar resgate InfinitePay', {
      selector: 'h3',
    });

    expect(screen.getByText(/V-0001/)).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('settlement-amount'), {
      target: { value: '61312' },
    });
    fireEvent.change(screen.getByLabelText('Data do resgate'), {
      target: { value: '2026-09-19' },
    });
    fireEvent.change(screen.getByLabelText('Observações (opcional)'), {
      target: { value: 'resgate total' },
    });

    const salesCallsBefore = mockGet.mock.calls.filter(
      ([url]) => url === '/sales',
    ).length;

    const form = screen.getByTestId('settlement-amount').closest('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/finances/settlements', {
        orderId: 'order-1',
        amount: 613.12,
        transactionDate: '2026-09-19',
        notes: 'resgate total',
      });
    });

    await waitFor(() => {
      const salesCallsAfter = mockGet.mock.calls.filter(
        ([url]) => url === '/sales',
      ).length;
      expect(salesCallsAfter).toBeGreaterThan(salesCallsBefore);
    });
  });

  it('validates the amount before calling the API', async () => {
    mockGetImplementation();
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('João Silva')).toBeInTheDocument(),
    );

    await clickSaleAction('order-1', 'Registrar-resgate-InfinitePay');
    await screen.findByText('Registrar resgate InfinitePay', {
      selector: 'h3',
    });

    const form = screen.getByTestId('settlement-amount').closest('form');
    fireEvent.submit(form);

    expect(
      await screen.findByTestId('settlement-form-error'),
    ).toHaveTextContent('Informe o valor do resgate');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('shows the backend rejection as a form error', async () => {
    mockPost.mockRejectedValue({
      response: {
        data: { error: 'Sale has no InfinitePay payment to settle' },
      },
    });
    mockGetImplementation();
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('João Silva')).toBeInTheDocument(),
    );

    await clickSaleAction('order-1', 'Registrar-resgate-InfinitePay');
    await screen.findByText('Registrar resgate InfinitePay', {
      selector: 'h3',
    });

    fireEvent.change(screen.getByTestId('settlement-amount'), {
      target: { value: '1000' },
    });
    const form = screen.getByTestId('settlement-amount').closest('form');
    fireEvent.submit(form);

    expect(
      await screen.findByTestId('settlement-form-error'),
    ).toHaveTextContent('Sale has no InfinitePay payment to settle');
  });

  it('asks to discard before closing with unsaved changes', async () => {
    mockGetImplementation();
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('João Silva')).toBeInTheDocument(),
    );

    await clickSaleAction('order-1', 'Registrar-resgate-InfinitePay');
    await screen.findByText('Registrar resgate InfinitePay', {
      selector: 'h3',
    });

    fireEvent.change(screen.getByTestId('settlement-amount'), {
      target: { value: '1000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(
      await screen.findByText('Descartar alterações?'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    await waitFor(() =>
      expect(screen.queryByTestId('settlement-modal')).not.toBeInTheDocument(),
    );
  });
});
