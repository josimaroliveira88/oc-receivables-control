import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OrdersPage from '../src/pages/OrdersPage';
import { ToastProvider } from '../src/components/Toast';
import { ORDER_ENTRY_MODE_KEY } from '../src/pages/Orders/useOrderEntryMode';
import { ZERO_TOTAL_PAYMENT_TYPE_MESSAGE } from '../src/pages/Orders/utils/orderHelpers';
import { paymentTypeLabel } from '../src/pages/Orders/utils/orderHelpers';

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

const mockProducts = [
  {
    id: 'prod-1',
    name: 'Adaptiv Pastilhas',
    code: '60226006',
    memberPrice: '90.00',
    pv: '15',
    status: 'ATIVO',
    productType: 'SIMPLES',
  },
];

const mockGetImplementation = (ordersData = []) => {
  mockGet.mockImplementation((url) => {
    if (url === '/orders') return Promise.resolve({ data: ordersData });
    if (url === '/people') return Promise.resolve({ data: [] });
    if (url.startsWith('/products'))
      return Promise.resolve({ data: { data: mockProducts } });
    return Promise.resolve({ data: [] });
  });
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <OrdersPage />
      </ToastProvider>
    </MemoryRouter>,
  );

const openCreateModal = async () => {
  await waitFor(() =>
    expect(screen.getByText('Novo Pedido')).toBeInTheDocument(),
  );
  fireEvent.click(screen.getByText('Novo Pedido'));
  await waitFor(() =>
    expect(
      screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
    ).toBeInTheDocument(),
  );
};

const orderNumberInput = () =>
  screen.getByPlaceholderText('Informe o número do pedido da dōTERRA');

const submitForm = () => {
  fireEvent.submit(orderNumberInput().closest('form'));
};

const setItemValue = (value) => {
  fireEvent.change(screen.getByPlaceholderText('0,00'), {
    target: { value },
  });
};

const setPaymentType = (value) => {
  fireEvent.change(screen.getByLabelText('Tipo de Pagamento'), {
    target: { value },
  });
};

// Picks a product in the spreadsheet grid and applies the given promotion %.
const fillSpreadsheetRow = async (discountPercent) => {
  const combobox = screen.getByPlaceholderText('Busque um produto...');
  fireEvent.change(combobox, { target: { value: 'Adaptiv' } });
  fireEvent.mouseDown(screen.getByText(/Adaptiv/));
  await waitFor(() =>
    expect(screen.getByText('Limpar produto')).toBeInTheDocument(),
  );
  fireEvent.change(screen.getByTestId('order-spreadsheet-discount-0'), {
    target: { value: discountPercent },
  });
};

describe('Order dōTERRA payment type', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockGetImplementation([]);
  });

  it('offers the dōTERRA option in the order payment type select', async () => {
    renderPage();
    await openCreateModal();

    const select = screen.getByLabelText('Tipo de Pagamento');
    const option = Array.from(select.options).find(
      (o) => o.value === 'DOTERRA',
    );
    expect(option).toBeDefined();
    expect(option.textContent).toBe('dōTERRA');
  });

  it('labels the badge with the dōTERRA name', () => {
    expect(paymentTypeLabel('DOTERRA')).toBe('dōTERRA');
  });

  it('saves a zero-total order paid with dōTERRA', async () => {
    mockPost.mockResolvedValue({ data: { id: 'new-order' } });
    renderPage();
    await openCreateModal();

    fireEvent.change(orderNumberInput(), { target: { value: 'ORD-DOT' } });
    setItemValue('0');
    setPaymentType('DOTERRA');

    expect(
      screen.queryByTestId('order-payment-type-error'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('order-payment-type-hint'),
    ).not.toBeInTheDocument();

    submitForm();

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    const payload = mockPost.mock.calls.find(([url]) => url === '/orders')[1];
    expect(payload.paymentType).toBe('DOTERRA');
  });

  it('warns as soon as dōTERRA is selected with a non-zero total', async () => {
    renderPage();
    await openCreateModal();

    fireEvent.change(orderNumberInput(), { target: { value: 'ORD-DOT' } });
    setItemValue('10000');
    setPaymentType('DOTERRA');

    await waitFor(() =>
      expect(screen.getByTestId('order-payment-type-hint')).toHaveTextContent(
        ZERO_TOTAL_PAYMENT_TYPE_MESSAGE,
      ),
    );
  });

  it('appears when the total changes after choosing dōTERRA', async () => {
    renderPage();
    await openCreateModal();

    fireEvent.change(orderNumberInput(), { target: { value: 'ORD-DOT' } });
    setItemValue('0');
    setPaymentType('DOTERRA');

    expect(
      screen.queryByTestId('order-payment-type-hint'),
    ).not.toBeInTheDocument();

    setItemValue('5000');

    await waitFor(() =>
      expect(screen.getByTestId('order-payment-type-hint')).toBeInTheDocument(),
    );
  });

  it('treats the shipping as part of the zero total', async () => {
    renderPage();
    await openCreateModal();

    fireEvent.change(orderNumberInput(), { target: { value: 'ORD-DOT' } });
    setItemValue('0');
    setPaymentType('DOTERRA');
    fireEvent.change(screen.getByTestId('order-freight'), {
      target: { value: '1500' },
    });

    await waitFor(() =>
      expect(screen.getByTestId('order-payment-type-hint')).toBeInTheDocument(),
    );
  });

  it('blocks saving and shows the field error for a non-zero total', async () => {
    renderPage();
    await openCreateModal();

    fireEvent.change(orderNumberInput(), { target: { value: 'ORD-DOT' } });
    setItemValue('10000');
    setPaymentType('DOTERRA');

    submitForm();

    await waitFor(() =>
      expect(screen.getByTestId('order-payment-type-error')).toHaveTextContent(
        ZERO_TOTAL_PAYMENT_TYPE_MESSAGE,
      ),
    );
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('clears the error when the payment type changes', async () => {
    renderPage();
    await openCreateModal();

    fireEvent.change(orderNumberInput(), { target: { value: 'ORD-DOT' } });
    setItemValue('10000');
    setPaymentType('DOTERRA');
    submitForm();

    await waitFor(() =>
      expect(
        screen.getByTestId('order-payment-type-error'),
      ).toBeInTheDocument(),
    );

    setPaymentType('PIX');

    await waitFor(() =>
      expect(
        screen.queryByTestId('order-payment-type-error'),
      ).not.toBeInTheDocument(),
    );
  });

  it('blocks the spreadsheet mode too', async () => {
    localStorage.setItem(ORDER_ENTRY_MODE_KEY, 'spreadsheet');
    renderPage();
    await openCreateModal();

    fireEvent.change(orderNumberInput(), { target: { value: 'ORD-DOT' } });
    setPaymentType('DOTERRA');
    // 50% promotion on a R$ 90 product leaves R$ 45 charged — a non-zero total.
    await fillSpreadsheetRow('50');

    submitForm();

    await waitFor(() =>
      expect(screen.getByTestId('order-payment-type-error')).toHaveTextContent(
        ZERO_TOTAL_PAYMENT_TYPE_MESSAGE,
      ),
    );
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('keeps the live warning out of the way of a zero-total spreadsheet order', async () => {
    localStorage.setItem(ORDER_ENTRY_MODE_KEY, 'spreadsheet');
    mockPost.mockResolvedValue({ data: { id: 'new-order' } });
    renderPage();
    await openCreateModal();

    fireEvent.change(orderNumberInput(), { target: { value: 'ORD-DOT' } });
    // 100% promotion leaves nothing charged, so the order total stays zero.
    await fillSpreadsheetRow('100');
    setPaymentType('DOTERRA');

    expect(
      screen.queryByTestId('order-payment-type-hint'),
    ).not.toBeInTheDocument();

    submitForm();

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    const payload = mockPost.mock.calls.find(([url]) => url === '/orders')[1];
    expect(payload.paymentType).toBe('DOTERRA');
  });

  it('shows the backend rejection as a toast when the client check is bypassed', async () => {
    mockPost.mockRejectedValue({
      response: { data: { error: ZERO_TOTAL_PAYMENT_TYPE_MESSAGE } },
    });
    renderPage();
    await openCreateModal();

    fireEvent.change(orderNumberInput(), { target: { value: 'ORD-DOT' } });
    setItemValue('0');
    setPaymentType('DOTERRA');
    submitForm();

    await waitFor(() =>
      expect(
        screen.getByText(ZERO_TOTAL_PAYMENT_TYPE_MESSAGE),
      ).toBeInTheDocument(),
    );
  });
});
