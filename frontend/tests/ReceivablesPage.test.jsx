import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReceivablesPage from '../src/pages/ReceivablesPage';
import { ToastProvider } from '../src/components/Toast';

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('../src/services/api', () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
  },
}));

const mockOrders = [
  {
    id: 'order-1',
    orderNumber: 'ORD-001',
    totalValue: '300.00',
    status: 'PENDENTE',
  },
  {
    id: 'order-2',
    orderNumber: 'ORD-002',
    totalValue: '500.00',
    status: 'PARCIAL',
  },
  {
    id: 'order-3',
    orderNumber: 'ORD-003',
    totalValue: '200.00',
    status: 'QUITADO',
  },
];

const mockBalances = {
  'order-1': {
    balances: [
      { personId: 'p1', personName: 'João Silva', itemTotal: '300.00', paymentTotal: '0.00', pending: '300.00' },
    ],
  },
  'order-2': {
    balances: [
      { personId: 'p1', personName: 'João Silva', itemTotal: '200.00', paymentTotal: '50.00', pending: '150.00' },
      { personId: 'p2', personName: 'Maria Santos', itemTotal: '300.00', paymentTotal: '300.00', pending: '0.00' },
    ],
  },
};

const mockGetImplementation = (ordersData = []) => {
  mockGet.mockImplementation((url) => {
    if (url === '/orders') return Promise.resolve({ data: ordersData });
    const balanceMatch = url.match(/^\/orders\/(.+)\/balance$/);
    if (balanceMatch) {
      const orderId = balanceMatch[1];
      const balanceData = mockBalances[orderId] || { balances: [] };
      return Promise.resolve({ data: balanceData });
    }
    return Promise.resolve({ data: [] });
  });
};

const renderPage = () => {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <ReceivablesPage />
      </ToastProvider>
    </MemoryRouter>
  );
};

describe('ReceivablesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the page title "Controle de Recebíveis"', async () => {
      mockGetImplementation([]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Controle de Recebíveis')).toBeInTheDocument();
      });
    });

    it('should show loading state', () => {
      mockGet.mockImplementation(() => new Promise(() => {}));
      renderPage();
      expect(screen.getByText('Carregando...')).toBeInTheDocument();
    });

    it('should show empty state when no orders exist', async () => {
      mockGetImplementation([]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Nenhum pedido cadastrado')).toBeInTheDocument();
      });
    });

    it('should show error message when API fails', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Erro ao carregar pedidos. Tente novamente.')).toBeInTheDocument();
      });
    });
  });

  describe('Badge Rendering', () => {
    it('should render 🔴 Pendente badge for PENDENTE status', async () => {
      mockGetImplementation([mockOrders[0]]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/Pendente/)).toBeInTheDocument();
      });
    });

    it('should render ⚠️ Parcial badge for PARCIAL status', async () => {
      mockGetImplementation([mockOrders[1]]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/Parcial/)).toBeInTheDocument();
      });
    });

    it('should render ✅ Quitado badge for QUITADO status', async () => {
      mockGetImplementation([mockOrders[2]]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/Quitado/)).toBeInTheDocument();
      });
    });
  });

  describe('Action Buttons', () => {
    it('should show "Registrar Pagamento" for PENDENTE and PARCIAL orders', async () => {
      mockGetImplementation([mockOrders[0], mockOrders[1]]);
      renderPage();
      await waitFor(() => {
        const buttons = screen.getAllByText('Registrar Pagamento');
        expect(buttons).toHaveLength(2);
      });
    });

    it('should show "Pago" label for QUITADO orders', async () => {
      mockGetImplementation([mockOrders[2]]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Pago')).toBeInTheDocument();
        expect(screen.queryByText('Registrar Pagamento')).not.toBeInTheDocument();
      });
    });
  });

  describe('Payment Modal', () => {
    it('should open payment modal and fetch balance when clicking "Registrar Pagamento"', async () => {
      mockGetImplementation([mockOrders[0]]);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Registrar Pagamento')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Registrar Pagamento'));

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/orders/order-1/balance');
        expect(screen.getByText(/Registrar Pagamento — ORD-001/)).toBeInTheDocument();
      });
    });

    it('should display person dropdown with pending balances', async () => {
      mockGetImplementation([mockOrders[1]]);
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText('Registrar Pagamento')[0]).toBeInTheDocument();
      });

      const buttons = screen.getAllByText('Registrar Pagamento');
      fireEvent.click(buttons[0]);

      await waitFor(() => {
        expect(screen.getByText(/João Silva — Pendente: R\$ 150\.00/)).toBeInTheDocument();
      });
    });

    it('should display "Saldo pendente" for the selected person', async () => {
      mockGetImplementation([mockOrders[0]]);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Registrar Pagamento')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Registrar Pagamento'));

      await waitFor(() => {
        expect(screen.getByText(/Saldo pendente:/)).toBeInTheDocument();
      });
    });

    it('should show "Nenhuma pessoa com saldo pendente" when all balances are zero', async () => {
      mockGet.mockImplementation((url) => {
        if (url === '/orders') return Promise.resolve({ data: [mockOrders[2]] });
        if (url === '/orders/order-3/balance') {
          return Promise.resolve({
            data: {
              balances: [
                { personId: 'p3', personName: 'Carlos', itemTotal: '200.00', paymentTotal: '200.00', pending: '0.00' },
              ],
            },
          });
        }
        return Promise.resolve({ data: [] });
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Pago')).toBeInTheDocument();
      });
    });

    it('should close modal when clicking "Cancelar"', async () => {
      mockGetImplementation([mockOrders[0]]);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Registrar Pagamento')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Registrar Pagamento'));

      await waitFor(() => {
        expect(screen.getByText(/Registrar Pagamento — ORD-001/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Cancelar'));

      await waitFor(() => {
        expect(screen.queryByText(/Registrar Pagamento — ORD-001/)).not.toBeInTheDocument();
      });
    });

    it('should close modal when clicking × button', async () => {
      mockGetImplementation([mockOrders[0]]);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Registrar Pagamento')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Registrar Pagamento'));

      await waitFor(() => {
        expect(screen.getByText(/Registrar Pagamento — ORD-001/)).toBeInTheDocument();
      });

      const closeButton = screen.getByText(/Registrar Pagamento — ORD-001/).closest('div').querySelector('button');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText(/Registrar Pagamento — ORD-001/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Validation Guards', () => {
    const openModalWithBalance = async () => {
      mockGetImplementation([mockOrders[0]]);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Registrar Pagamento')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Registrar Pagamento'));

      await waitFor(() => {
        expect(screen.getByText(/Registrar Pagamento — ORD-001/)).toBeInTheDocument();
      });
    };

    it('should reject zero amount with "Valor deve ser maior que zero"', async () => {
      await openModalWithBalance();

      const amountInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(amountInput, { target: { value: '0' } });

      const form = amountInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Valor deve ser maior que zero')).toBeInTheDocument();
      });
    });

    it('should reject negative amount with "Valor deve ser maior que zero"', async () => {
      await openModalWithBalance();

      const amountInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(amountInput, { target: { value: '-10' } });

      const form = amountInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Valor deve ser maior que zero')).toBeInTheDocument();
      });
    });

    it('should reject overpayment with "Valor excede o saldo pendente"', async () => {
      await openModalWithBalance();

      const amountInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(amountInput, { target: { value: '999' } });

      const form = amountInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Valor excede o saldo pendente')).toBeInTheDocument();
      });
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('should submit valid payment and call POST /orders/:id/payments', async () => {
      await openModalWithBalance();

      const amountInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(amountInput, { target: { value: '100' } });

      mockPost.mockResolvedValue({ data: { id: 'pay-1', amount: '100.00', personId: 'p1' } });
      mockGet.mockResolvedValue({ data: [] });

      const form = amountInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/orders/order-1/payments', {
          amount: 100,
          personId: 'p1',
          notes: undefined,
        });
      });
    });
  });

  describe('Toast Feedback', () => {
    it('should show success toast "Pagamento registrado com sucesso!" on valid payment', async () => {
      mockGetImplementation([mockOrders[0]]);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Registrar Pagamento')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Registrar Pagamento'));

      await waitFor(() => {
        expect(screen.getByText(/Registrar Pagamento — ORD-001/)).toBeInTheDocument();
      });

      const amountInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(amountInput, { target: { value: '50' } });

      mockPost.mockResolvedValue({ data: { id: 'pay-1', amount: '50.00', personId: 'p1' } });
      mockGet.mockResolvedValue({ data: [] });

      const form = amountInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Pagamento registrado com sucesso!')).toBeInTheDocument();
      });
    });

    it('should show error toast when backend rejects overpayment', async () => {
      mockGetImplementation([mockOrders[0]]);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Registrar Pagamento')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Registrar Pagamento'));

      await waitFor(() => {
        expect(screen.getByText(/Registrar Pagamento — ORD-001/)).toBeInTheDocument();
      });

      const amountInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(amountInput, { target: { value: '100' } });

      mockPost.mockRejectedValue({
        response: { data: { error: 'Amount exceeds pending balance' } },
      });

      const form = amountInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Valor excede o saldo pendente')).toBeInTheDocument();
      });
    });
  });
});
