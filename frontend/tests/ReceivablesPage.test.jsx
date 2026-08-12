import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
  {
    id: 'order-4',
    orderNumber: 'ORD-004',
    totalValue: '0.00',
    status: 'PENDENTE',
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
  'order-4': {
    balances: [
      { personId: 'p4', personName: 'Brinde Person', itemTotal: '0.00', paymentTotal: '0.00', pending: '0.00' },
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
        expect(screen.getByText(/João Silva — Pendente: R\$\s*150,00/)).toBeInTheDocument();
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

    it('should not show "Nenhuma pessoa neste pedido" and list zero-balance persons', async () => {
      mockGetImplementation([mockOrders[3]]);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Registrar Pagamento')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Registrar Pagamento'));

      await waitFor(() => {
        expect(screen.getByText(/Registrar Pagamento — ORD-004/)).toBeInTheDocument();
      });

      expect(screen.queryByText('Nenhuma pessoa neste pedido')).not.toBeInTheDocument();
      expect(screen.getByText(/Brinde Person — Nada a receber/)).toBeInTheDocument();
    });

    it('should show "Dar baixa" button and submit a zero payment for a zero-balance person', async () => {
      mockGetImplementation([mockOrders[3]]);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Registrar Pagamento')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Registrar Pagamento'));

      await waitFor(() => {
        expect(screen.getByText(/Registrar Pagamento — ORD-004/)).toBeInTheDocument();
      });

      expect(screen.getByText(/Nada a receber — baixa sem valor/)).toBeInTheDocument();
      expect(screen.getByText('Dar baixa')).toBeInTheDocument();

      const amountInput = screen.getByPlaceholderText('0.00');
      const form = amountInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/orders/order-4/payments', {
          amount: 0,
          personId: 'p4',
          paidAt: expect.any(String),
          notes: undefined,
        });
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

    it('should allow submitting a zero amount for a zero-balance person', async () => {
      mockGetImplementation([mockOrders[3]]);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Registrar Pagamento')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Registrar Pagamento'));

      await waitFor(() => {
        expect(screen.getByText(/Registrar Pagamento — ORD-004/)).toBeInTheDocument();
      });

      const amountInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(amountInput, { target: { value: '0' } });

      const form = amountInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalled();
      });
    });

    it('should reject zero amount when the person has a pending balance', async () => {
      await openModalWithBalance();

      const amountInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(amountInput, { target: { value: '0' } });

      const form = amountInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Valor deve ser maior que zero')).toBeInTheDocument();
      });
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('should reject negative amount with "Valor não pode ser negativo"', async () => {
      await openModalWithBalance();

      const amountInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(amountInput, { target: { value: '-10' } });

      const form = amountInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Valor não pode ser negativo')).toBeInTheDocument();
      });
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('should ask for confirmation on overpayment and submit when confirmed', async () => {
      await openModalWithBalance();

      const amountInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(amountInput, { target: { value: '999' } });

      mockPost.mockResolvedValue({ data: { id: 'pay-over', amount: '999.00' } });
      mockGet.mockResolvedValue({ data: [] });

      const form = amountInput.closest('form');
      fireEvent.submit(form);

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText(/maior que o saldo pendente/)).toBeInTheDocument();
      expect(within(dialog).getByText(/R\$\s*999,00/)).toBeInTheDocument();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar recebimento' }));

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/orders/order-1/payments', {
          amount: 999,
          personId: 'p1',
          paidAt: expect.any(String),
          notes: undefined,
        });
      });
    });

    it('should not submit overpayment when confirmation is cancelled', async () => {
      await openModalWithBalance();

      const amountInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(amountInput, { target: { value: '999' } });

      const form = amountInput.closest('form');
      fireEvent.submit(form);

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText(/maior que o saldo pendente/)).toBeInTheDocument();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('should not show the overpayment confirmation when amount equals the pending balance', async () => {
      await openModalWithBalance();

      const amountInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(amountInput, { target: { value: '300' } });

      mockPost.mockResolvedValue({ data: { id: 'pay-full', amount: '300.00', personId: 'p1' } });
      mockGet.mockResolvedValue({ data: [] });

      const form = amountInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/orders/order-1/payments', {
          amount: 300,
          personId: 'p1',
          paidAt: expect.any(String),
          notes: undefined,
        });
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
          paidAt: expect.any(String),
          notes: undefined,
        });
      });
    });
  });

  describe('Floating point precision (cents)', () => {
    it('should accept exact remaining balance without floating point rejection', async () => {
      mockGet.mockImplementation((url) => {
        if (url === '/orders') {
          return Promise.resolve({ data: [{
            id: 'order-fp',
            orderNumber: 'ORD-FP',
            totalValue: '1234.56',
            status: 'PARCIAL',
          }] });
        }
        if (url === '/orders/order-fp/balance') {
          return Promise.resolve({ data: {
            balances: [
              { personId: 'p1', personName: 'João', itemTotal: 1234.56, paymentTotal: 1233, pending: 1.56 },
            ],
          } });
        }
        return Promise.resolve({ data: [] });
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Registrar Pagamento')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Registrar Pagamento'));

      await waitFor(() => {
        expect(screen.getByText(/Registrar Pagamento — ORD-FP/)).toBeInTheDocument();
      });

      const amountInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(amountInput, { target: { value: '1.56' } });

      mockPost.mockResolvedValue({ data: { id: 'pay-fp', amount: '1.56', personId: 'p1' } });
      mockGet.mockResolvedValue({ data: [] });

      const form = amountInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/orders/order-fp/payments', {
          amount: 1.56,
          personId: 'p1',
          paidAt: expect.any(String),
          notes: undefined,
        });
      });

      expect(screen.queryByText('Valor excede o saldo pendente')).not.toBeInTheDocument();
    });
  });

  describe('Payment Date Field', () => {
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

    it('should show date input with label "Data do Pagamento"', async () => {
      await openModalWithBalance();

      expect(screen.getByLabelText('Data do Pagamento')).toBeInTheDocument();
    });

    it('should default date input to today', async () => {
      await openModalWithBalance();

      const dateInput = screen.getByLabelText('Data do Pagamento');
      const today = new Date();
      const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      expect(dateInput.value).toBe(expected);
    });

    it('should allow changing the payment date', async () => {
      await openModalWithBalance();

      const dateInput = screen.getByLabelText('Data do Pagamento');
      fireEvent.change(dateInput, { target: { value: '2025-06-15' } });

      expect(dateInput.value).toBe('2025-06-15');
    });

    it('should send paidAt in the payment request', async () => {
      await openModalWithBalance();

      const dateInput = screen.getByLabelText('Data do Pagamento');
      fireEvent.change(dateInput, { target: { value: '2025-06-15' } });

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
          paidAt: '2025-06-15',
          notes: undefined,
        });
      });
    });

    it('should reset date to today when reopening the modal', async () => {
      await openModalWithBalance();

      const dateInput = screen.getByLabelText('Data do Pagamento');
      fireEvent.change(dateInput, { target: { value: '2025-01-01' } });
      expect(dateInput.value).toBe('2025-01-01');

      fireEvent.click(screen.getByText('Cancelar'));

      await waitFor(() => {
        expect(screen.queryByText(/Registrar Pagamento — ORD-001/)).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Registrar Pagamento'));

      await waitFor(() => {
        const resetDateInput = screen.getByLabelText('Data do Pagamento');
        const today = new Date();
        const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        expect(resetDateInput.value).toBe(expected);
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

    it('should map a backend "pending balance" error string to the PT-BR toast', async () => {
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
