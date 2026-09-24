import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OrdersPage from '../src/pages/OrdersPage';
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

const mockGetImplementation = () => {
  mockGet.mockImplementation((url) => {
    if (url === '/orders') return Promise.resolve({ data: [] });
    if (url === '/people')
      return Promise.resolve({ data: [{ id: 'p1', name: 'João Silva' }] });
    if (url.startsWith('/products'))
      return Promise.resolve({ data: { data: [] } });
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

const fillRequiredFields = () => {
  fireEvent.change(
    screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
    { target: { value: 'ORD-CC' } },
  );
  fireEvent.change(screen.getByPlaceholderText('0,00'), {
    target: { value: '10000' },
  });
};

const submitForm = () => {
  const form = screen
    .getByPlaceholderText('Informe o número do pedido da dōTERRA')
    .closest('form');
  fireEvent.submit(form);
};

describe('OrderDetailsFields credit-card fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetImplementation();
  });

  it('renders installments and first installment date for CARTAO_CREDITO', async () => {
    renderPage();
    await openCreateModal();

    expect(screen.queryByLabelText('Parcelas')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Tipo de Pagamento'), {
      target: { value: 'CARTAO_CREDITO' },
    });

    expect(screen.getByLabelText('Parcelas')).toBeInTheDocument();
    expect(screen.getByLabelText('Primeira parcela')).toBeInTheDocument();
  });

  it('hides and drops the fields from the payload when the type changes', async () => {
    mockPost.mockResolvedValue({ data: { id: 'new-order' } });
    renderPage();
    await openCreateModal();

    fireEvent.change(screen.getByLabelText('Tipo de Pagamento'), {
      target: { value: 'CARTAO_CREDITO' },
    });
    fireEvent.change(screen.getByLabelText('Parcelas'), {
      target: { value: '6' },
    });
    fireEvent.change(screen.getByLabelText('Primeira parcela'), {
      target: { value: '2026-10-15' },
    });

    fireEvent.change(screen.getByLabelText('Tipo de Pagamento'), {
      target: { value: 'PIX' },
    });

    expect(screen.queryByLabelText('Parcelas')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Primeira parcela')).not.toBeInTheDocument();

    fillRequiredFields();
    submitForm();

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    const payload = mockPost.mock.calls.find(([url]) => url === '/orders')[1];
    expect(payload.paymentType).toBe('PIX');
    expect(payload).not.toHaveProperty('installments');
    expect(payload).not.toHaveProperty('firstInstallmentAt');
  });

  it('shows the backend error when credit-card fields are missing', async () => {
    mockPost.mockRejectedValue({
      response: {
        data: {
          error:
            'A quantidade de parcelas é obrigatória para pedidos com cartão de crédito',
        },
      },
    });
    renderPage();
    await openCreateModal();

    fireEvent.change(screen.getByLabelText('Tipo de Pagamento'), {
      target: { value: 'CARTAO_CREDITO' },
    });
    fillRequiredFields();
    submitForm();

    expect(
      await screen.findByText(
        'A quantidade de parcelas é obrigatória para pedidos com cartão de crédito',
      ),
    ).toBeInTheDocument();
  });
});
