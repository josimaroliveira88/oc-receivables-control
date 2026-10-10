import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProductsPage from '../src/pages/ProductsPage';
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

const mockProduct = {
  id: '1',
  code: '60226006',
  name: 'Adaptiv® Pastilhas',
  size: '60 pastilhas',
  status: 'ATIVO',
  regularPrice: 308.0,
  memberPrice: 231.25,
  pv: 31,
  pricePerPv: '7.46',
  doterraUrl: null,
};

const fullResponse = (data) => ({
  data,
  pagination: {
    page: 1,
    pageSize: Math.max(data.length, 1),
    total: data.length,
    totalPages: 1,
    hasMore: false,
  },
});

const baseSnapshot = (overrides = {}) => ({
  product: {
    id: '1',
    code: '60226006',
    name: 'Adaptiv® Pastilhas',
    size: '60 pastilhas',
    status: 'ATIVO',
    productType: 'SIMPLES',
  },
  references: {
    orderItems: [],
    inventory: null,
    stockMovements: [],
    stockExchangeLines: [],
    kitComponents: [],
    kitComposition: [],
  },
  blockers: {
    inventory: false,
    stockMovements: false,
    stockExchangeLines: false,
    kitComponent: false,
  },
  counts: {
    orderItems: 0,
    inventory: 0,
    stockMovements: 0,
    stockExchangeLines: 0,
    kitComponents: 0,
    kitComposition: 0,
  },
  deletable: true,
  ...overrides,
});

let usageResponse;

const renderPage = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <ProductsPage />
      </ToastProvider>
    </MemoryRouter>,
  );

const openUsage = async () => {
  await waitFor(() => {
    expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
  });
  fireEvent.click(screen.getByTestId('product-actions-1-trigger'));
  fireEvent.click(
    screen.getByTestId('product-actions-1-item-Ver-onde-e-usado'),
  );
  await waitFor(() => {
    expect(screen.getByTestId('product-usage-modal')).toBeInTheDocument();
  });
};

describe('Product usage modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usageResponse = baseSnapshot();
    mockGet.mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/usage')) {
        return Promise.resolve({ data: usageResponse });
      }
      return Promise.resolve({ data: fullResponse([mockProduct]) });
    });
    mockDelete.mockResolvedValue({ data: { removed: 1 } });
    global.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it('opens the usage panel and lists order/sale references with a navigation action', async () => {
    usageResponse = baseSnapshot({
      references: {
        ...baseSnapshot().references,
        orderItems: [
          {
            id: 'item-1',
            orderId: 'order-1',
            orderNumber: '1234',
            orderType: 'COMPRA',
            isTeamOrder: false,
            quantity: 2,
            chargedValue: 240,
            description: null,
            personName: 'Eu',
          },
        ],
      },
      counts: { ...baseSnapshot().counts, orderItems: 1 },
    });

    renderPage();
    await openUsage();

    expect(mockGet).toHaveBeenCalledWith('/products/1/usage');
    expect(screen.getByText(/Pedido 1234/)).toBeInTheDocument();
    expect(screen.getByText('Abrir')).toBeInTheDocument();
    // No blockers -> delete button enabled.
    expect(screen.getByTestId('product-usage-delete')).toBeEnabled();
  });

  it('lists the blocking references and keeps the delete action available', async () => {
    usageResponse = baseSnapshot({
      references: {
        ...baseSnapshot().references,
        inventory: { id: 'inv-1', quantity: 5 },
      },
      blockers: { ...baseSnapshot().blockers, inventory: true },
      counts: { ...baseSnapshot().counts, inventory: 1 },
      deletable: false,
    });

    renderPage();
    await openUsage();

    expect(screen.getByTestId('product-usage-blockers')).toBeInTheDocument();
    // Deleting is still possible: the purge removes every reference at once.
    expect(screen.getByTestId('product-usage-delete')).toBeEnabled();
  });

  it('removes a reference after confirmation and unblocks the deletion', async () => {
    usageResponse = baseSnapshot({
      references: {
        ...baseSnapshot().references,
        inventory: { id: 'inv-1', quantity: 5 },
      },
      blockers: { ...baseSnapshot().blockers, inventory: true },
      counts: { ...baseSnapshot().counts, inventory: 1 },
      deletable: false,
    });

    renderPage();
    await openUsage();

    fireEvent.click(screen.getByTestId('product-usage-remove-inventory'));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByText(/O estoque atual \(5 unidade\(s\)\) será descartado/),
    ).toBeInTheDocument();

    // Next usage fetch becomes unblocked.
    usageResponse = baseSnapshot();

    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith(
        '/products/1/references/inventory',
      );
    });

    await waitFor(() => {
      expect(
        screen.queryByTestId('product-usage-blockers'),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('product-usage-delete')).toBeEnabled();
  });

  it('hard-deletes the product after a final confirmation and reloads the list', async () => {
    mockPost.mockResolvedValue({ data: { message: 'Produto excluído' } });
    usageResponse = baseSnapshot({
      references: {
        ...baseSnapshot().references,
        orderItems: [
          {
            id: 'item-1',
            orderId: 'order-1',
            orderNumber: 'Dra. Gabi',
            orderType: 'VENDA',
            isTeamOrder: false,
            quantity: 1,
            chargedValue: 100,
            description: null,
            personName: 'Cliente',
          },
        ],
        affectedOrders: [
          {
            orderId: 'order-1',
            orderNumber: 'Dra. Gabi',
            orderType: 'VENDA',
            isTeamOrder: false,
            removedItems: 1,
            oldTotalCents: 16000,
            newTotalCents: 6000,
            linkedTransactionOrigin: 'VENDA_ADICIONAL',
          },
        ],
      },
      counts: { ...baseSnapshot().counts, orderItems: 1 },
    });
    renderPage();
    await openUsage();

    fireEvent.click(screen.getByTestId('product-usage-delete'));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByText(/será apagado definitivamente do banco de dados/),
    ).toBeInTheDocument();
    // The impact alert shows the new vs. current order total.
    expect(screen.getByText(/ficará em R\$\s*60,00/)).toBeInTheDocument();
    expect(screen.getByText(/era R\$\s*160,00/)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Excluir definitivamente' }),
    );

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/products/1/purge');
    });

    await waitFor(() => {
      expect(
        screen.queryByTestId('product-usage-modal'),
      ).not.toBeInTheDocument();
    });
    // The product list is refetched after a successful delete.
    expect(mockGet).toHaveBeenCalledWith('/products?pageSize=all');
  });

  it('keeps the modal open and shows an error when the purge fails', async () => {
    mockPost.mockRejectedValue({
      response: {
        status: 500,
        data: { error: 'Erro ao excluir produto. Tente novamente.' },
      },
    });
    renderPage();
    await openUsage();

    fireEvent.click(screen.getByTestId('product-usage-delete'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Excluir definitivamente' }),
    );

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/products/1/purge');
    });
    // The modal stays open so the user can retry.
    expect(screen.getByTestId('product-usage-modal')).toBeInTheDocument();
  });
});
