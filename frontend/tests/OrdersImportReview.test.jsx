import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OrdersPage from '../src/pages/OrdersPage';
import { ToastProvider } from '../src/components/Toast';
import { ORDER_ENTRY_MODE_KEY } from '../src/pages/Orders/useOrderEntryMode';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('../src/services/api', () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    patch: (...args) => mockPatch(...args),
    put: (...args) => mockPut(...args),
    delete: (...args) => mockDelete(...args),
  },
}));

const pendingOrder = {
  id: 'p1',
  orderNumber: 'DT-1001',
  orderDate: '2026-09-02T00:00:00.000Z',
  totalValue: '300.00',
  status: 'PENDENTE',
  accountOwner: 'Gouveia Lima, Cássia',
  paymentType: 'BOLETO',
  orderNotes: null,
  doterraPv: '40.00',
  doterraValue: '300.00',
  pendingReview: true,
  isTeamOrder: false,
  attachmentFilename: null,
  items: [
    {
      id: 'i1',
      description: 'Item',
      chargedValue: '300.00',
      quantity: 1,
      chargedValueMode: 'UNIT',
      personId: 'self-1',
      person: { name: 'Eu Mesmo', isSelf: true },
      productId: null,
      memberPrice: null,
    },
  ],
};

const mockGetImplementation = (ordersData) => {
  mockGet.mockImplementation((url) => {
    if (url === '/orders') return Promise.resolve({ data: ordersData });
    if (url === '/people') return Promise.resolve({ data: [] });
    if (url.startsWith('/products'))
      return Promise.resolve({ data: { data: [] } });
    if (url === '/api-tokens') return Promise.resolve({ data: [] });
    return Promise.resolve({ data: [] });
  });
};

// Product auto-registered by the import as a draft (PENDENTE_CADASTRO). It is
// intentionally absent from the products list, so the order form must render
// its code as a link to the Products edit modal instead of the picker.
const draftProduct = {
  id: 'pr-draft',
  name: 'Produto do Mês',
  code: '5025',
  status: 'PENDENTE_CADASTRO',
  productType: 'SIMPLES',
};

const draftOrder = {
  ...pendingOrder,
  items: [
    {
      id: 'i1',
      description: 'Produto do Mês',
      chargedValue: '0.00',
      quantity: 1,
      chargedValueMode: 'UNIT',
      personId: 'self-1',
      person: { name: 'Eu Mesmo', isSelf: true },
      productId: 'pr-draft',
      memberPrice: null,
      product: draftProduct,
    },
  ],
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <OrdersPage />
      </ToastProvider>
    </MemoryRouter>,
  );

const LocationProbe = () => {
  const location = useLocation();
  return (
    <div data-testid="location">{`${location.pathname}${location.search}`}</div>
  );
};

// Renders the orders page with a /products route that reports the current
// location, so navigation from the order form can be asserted.
const renderWithRoutes = (initialEntries) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<OrdersPage />} />
          <Route path="/products" element={<LocationProbe />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );

describe('Orders import and review workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('lists imported orders by sending the pendingReview filter', async () => {
    mockGetImplementation([pendingOrder]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('DT-1001')).toBeInTheDocument();
    });

    const reviewFilter = screen.getByTestId('orders-filter-review');
    fireEvent.change(reviewFilter, { target: { value: 'yes' } });

    await waitFor(() => {
      const lastOrdersCall = mockGet.mock.calls
        .filter(([url]) => url === '/orders')
        .pop();
      expect(lastOrdersCall[1].params).toMatchObject({ pendingReview: 'yes' });
    });
  });

  it('shows the "Pendente de revisão" badge for a pending imported order', async () => {
    mockGetImplementation([pendingOrder]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('order-review-badge')).toHaveTextContent(
        'Pendente de revisão',
      );
    });
  });

  it('marks an order reviewed through the row quick action', async () => {
    mockGetImplementation([pendingOrder]);
    mockPatch.mockResolvedValue({
      data: { ...pendingOrder, pendingReview: false },
    });
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByTestId('order-actions-p1-trigger'),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('order-actions-p1-trigger'));
    await waitFor(() => {
      expect(
        screen.getByTestId('order-actions-p1-item-Marcar-revisado'),
      ).toBeInTheDocument();
    });
    fireEvent.click(
      screen.getByTestId('order-actions-p1-item-Marcar-revisado'),
    );

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/orders/p1/review');
    });
  });

  it('imports pasted orders and renders the summary', async () => {
    mockGetImplementation([]);
    mockPost.mockResolvedValue({
      data: {
        created: [{ orderNumber: 'DT-2002', id: 'o2', warnings: [] }],
        existing: [],
        failed: [],
        createdProducts: [{ code: 'X1', name: 'Rascunho' }],
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('doterra-import-open')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('doterra-import-open'));

    const textarea = await screen.findByTestId('doterra-import-json');
    fireEvent.change(textarea, {
      target: {
        value: JSON.stringify({ orders: [{ orderNumber: 'DT-2002' }] }),
      },
    });
    fireEvent.click(screen.getByTestId('doterra-import-submit'));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/doterra/orders/import', {
        orders: [{ orderNumber: 'DT-2002' }],
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('doterra-import-created')).toHaveTextContent(
        '1',
      );
    });
  });

  it('shows a draft product as a code link and opens its Products edit modal (detailed form)', async () => {
    mockGetImplementation([draftOrder]);
    renderWithRoutes(['/?editOrder=p1']);

    const link = await screen.findByTestId('order-item-pending-product-0');
    expect(link).toHaveTextContent('5025');
    // The picker is replaced by the link for draft products.
    expect(
      screen.queryByPlaceholderText('Busque um produto...'),
    ).not.toBeInTheDocument();

    fireEvent.click(link);
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/products?edit=pr-draft',
      );
    });
  });

  it('shows the draft product code link in spreadsheet mode too', async () => {
    window.localStorage.setItem(ORDER_ENTRY_MODE_KEY, 'spreadsheet');
    mockGetImplementation([draftOrder]);
    renderWithRoutes(['/?editOrder=p1']);

    const link = await screen.findByTestId(
      'order-spreadsheet-pending-product-0',
    );
    expect(link).toHaveTextContent('5025');

    fireEvent.click(link);
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/products?edit=pr-draft',
      );
    });
  });
});
