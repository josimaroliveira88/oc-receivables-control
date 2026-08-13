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
    orderDate: '2026-08-01',
    accountOwner: 'Ana Silva',
    orderNotes: 'Pedido de teste',
    totalValue: '300.00',
    status: 'PENDENTE',
    items: [{ pv: '10.50' }, { pv: '5.00' }],
    payments: [],
  },
  {
    id: 'order-2',
    orderNumber: 'ORD-002',
    orderDate: '2026-08-02',
    accountOwner: null,
    orderNotes: 'Descrição ORD-002',
    totalValue: '500.00',
    status: 'PARCIAL',
    items: [{ pv: '20.00' }],
    payments: [{ amount: '50.00' }],
  },
  {
    id: 'order-3',
    orderNumber: 'ORD-003',
    orderDate: '2026-08-03',
    accountOwner: 'Carlos Souza',
    orderNotes: null,
    totalValue: '200.00',
    status: 'QUITADO',
    items: [{ pv: '5.00' }],
    payments: [{ amount: '250.00' }],
  },
  {
    id: 'order-4',
    orderNumber: 'ORD-004',
    orderDate: '2026-08-04',
    accountOwner: null,
    orderNotes: null,
    totalValue: '0.00',
    status: 'PENDENTE',
    items: [{ pv: '0.00' }],
    payments: [],
  },
];

const paidOrder = {
  id: 'order-paid',
  orderNumber: 'ORD-PAID',
  orderDate: '2026-08-06',
  accountOwner: null,
  orderNotes: null,
  totalValue: '100.00',
  status: 'PARCIAL',
  items: [],
  payments: [{ amount: '100.00' }],
};

const richOrder = {
  id: 'order-rich',
  orderNumber: 'ORD-RICH',
  orderDate: '2026-08-05',
  accountOwner: 'Roberta Lima',
  orderNotes: 'Pedido de julho',
  totalValue: '234.56',
  status: 'PARCIAL',
  items: [
    { id: 'item-1', personId: 'p1', description: 'Lemongrass Óleo Essencial 15ml', details: 'Uso doméstico', chargedValue: '89.00', pv: '10.00' },
    { id: 'item-2', personId: 'p1', description: 'On Guard + 30ml', details: null, chargedValue: '145.56', pv: '20.00' },
    { id: 'item-3', personId: 'p2', description: 'Deep Blue Rub', details: 'Para o cliente X', chargedValue: '50.00', pv: '5.00' },
  ],
  payments: [],
};

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
  'order-paid': {
    balances: [
      { personId: 'p1', personName: 'João Silva', itemTotal: '100.00', paymentTotal: '100.00', pending: '0.00' },
    ],
  },
  'order-overpaid': {
    balances: [
      { personId: 'p1', personName: 'João Silva', itemTotal: '100.00', paymentTotal: '150.00', pending: '0.00' },
    ],
  },
  'order-rich': {
    balances: [
      { personId: 'p1', personName: 'João Silva', itemTotal: '234.56', paymentTotal: '0.00', pending: '234.56' },
      { personId: 'p2', personName: 'Maria Santos', itemTotal: '50.00', paymentTotal: '0.00', pending: '50.00' },
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

const openPaymentAction = async (orderId, label = 'Registrar Pagamento') => {
  await waitFor(() => {
    expect(screen.getByTestId(`receivable-actions-${orderId}-trigger`)).toBeInTheDocument();
  });
  fireEvent.click(screen.getByTestId(`receivable-actions-${orderId}-trigger`));
  await waitFor(() => {
    expect(screen.getByTestId(`receivable-actions-${orderId}-menu`)).toBeInTheDocument();
  });
  const itemId = label === 'Dar baixa' ? 'Dar-baixa' : 'Registrar-Pagamento';
  fireEvent.click(screen.getByTestId(`receivable-actions-${orderId}-item-${itemId}`));
  await waitFor(() => {
    expect(screen.getByTestId('payment-modal')).toBeInTheDocument();
  });
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
        expect(screen.getByText('Pendente')).toBeInTheDocument();
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
    it('should show payment actions inside the dropdown for PENDENTE and PARCIAL orders', async () => {
      mockGetImplementation([mockOrders[0], mockOrders[1]]);
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId(/^receivable-actions-.*-trigger$/)).toHaveLength(2);
      });
      fireEvent.click(screen.getByTestId('receivable-actions-order-1-trigger'));
      expect(screen.getByTestId('receivable-actions-order-1-item-Registrar-Pagamento')).toHaveTextContent('Registrar Pagamento');
      expect(screen.getByTestId('receivable-actions-order-1-item-Detalhar')).toBeInTheDocument();
    });

    it('should show only the kebab trigger (no "Pago" text, no payment button) for QUITADO orders', async () => {
      mockGetImplementation([mockOrders[2]]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('ORD-003')).toBeInTheDocument();
      });
      expect(screen.queryByText('Pago')).not.toBeInTheDocument();
      expect(screen.queryByText('Registrar Pagamento')).not.toBeInTheDocument();
      expect(screen.getByTestId('receivable-actions-order-3-trigger')).toBeInTheDocument();
    });
  });

  describe('Action Menu (kebab)', () => {
    const rowForOrder = (orderNumber) => screen.getByText(orderNumber).closest('tr');

    const openReceivableMenu = async (orderId) => {
      await waitFor(() => {
        expect(screen.getByTestId(`receivable-actions-${orderId}-trigger`)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId(`receivable-actions-${orderId}-trigger`));
      await waitFor(() => {
        expect(screen.getByTestId(`receivable-actions-${orderId}-menu`)).toBeInTheDocument();
      });
    };

    it('should render one kebab trigger per row', async () => {
      mockGetImplementation(mockOrders);
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId(/^receivable-actions-.*-trigger$/)).toHaveLength(4);
      });
    });

    it('should show the highlighted "Registrar Pagamento" item inside the dropdown for orders with pending balance', async () => {
      mockGetImplementation([mockOrders[0], mockOrders[1]]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('receivable-actions-order-1-trigger')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('receivable-actions-order-1-trigger'));
      expect(screen.getByTestId('receivable-actions-order-1-item-Registrar-Pagamento')).toHaveClass('bg-primary-600');
      expect(screen.getByTestId('receivable-actions-order-1-item-Detalhar')).toBeInTheDocument();
    });

    it('should show "Dar baixa" inside the dropdown for zero-value orders still pending settlement', async () => {
      mockGetImplementation([mockOrders[3]]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('ORD-004')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('receivable-actions-order-4-trigger'));
      expect(screen.getByTestId('receivable-actions-order-4-item-Dar-baixa')).toBeInTheDocument();
      expect(screen.getByTestId('receivable-actions-order-4-item-Detalhar')).toBeInTheDocument();
      expect(screen.queryByTestId('receivable-actions-order-4-item-Registrar-Pagamento')).not.toBeInTheDocument();
    });

    it('should treat fully paid PARCIAL orders as quitado (kebab only)', async () => {
      mockGetImplementation([paidOrder]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('ORD-PAID')).toBeInTheDocument();
      });
      expect(screen.queryByText('Registrar Pagamento')).not.toBeInTheDocument();
      expect(screen.getByTestId('receivable-actions-order-paid-trigger')).toBeInTheDocument();
    });

    it('should keep the menu hidden until the trigger is clicked', async () => {
      mockGetImplementation([mockOrders[0]]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('ORD-001')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('receivable-actions-order-1-menu')).not.toBeInTheDocument();
    });

    it('should show "Detalhar" when the kebab is opened for a pending order', async () => {
      mockGetImplementation([mockOrders[0]]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('ORD-001')).toBeInTheDocument();
      });
      await openReceivableMenu('order-1');
      expect(screen.getByText('Detalhar')).toBeInTheDocument();
    });

    it('should call the "Detalhar" callback and close the menu on item click', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockGetImplementation([mockOrders[2]]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('ORD-003')).toBeInTheDocument();
      });
      await openReceivableMenu('order-3');
      fireEvent.click(screen.getByTestId('receivable-actions-order-3-item-Detalhar'));
      expect(consoleSpy).toHaveBeenCalledWith('Detalhar — pedido', 'order-3');
      expect(screen.queryByTestId('receivable-actions-order-3-menu')).not.toBeInTheDocument();
      consoleSpy.mockRestore();
    });

    it('should set a11y semantics on trigger and menu', async () => {
      mockGetImplementation([mockOrders[2]]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('ORD-003')).toBeInTheDocument();
      });
      const trigger = screen.getByTestId('receivable-actions-order-3-trigger');
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(trigger);
      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      });
      const menu = screen.getByTestId('receivable-actions-order-3-menu');
      expect(menu).toHaveAttribute('role', 'menu');
      const menuitem = within(menu).getByRole('menuitem');
      expect(menuitem).toHaveTextContent('Detalhar');
      expect(menuitem).toHaveAttribute('role', 'menuitem');
    });

    it('should close the menu when clicking the backdrop', async () => {
      mockGetImplementation([mockOrders[2]]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('ORD-003')).toBeInTheDocument();
      });
      await openReceivableMenu('order-3');
      fireEvent.click(screen.getByTestId('receivable-actions-order-3-backdrop'));
      await waitFor(() => {
        expect(screen.queryByTestId('receivable-actions-order-3-menu')).not.toBeInTheDocument();
      });
    });

    it('should close the menu when pressing Escape', async () => {
      mockGetImplementation([mockOrders[2]]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('ORD-003')).toBeInTheDocument();
      });
      await openReceivableMenu('order-3');
      fireEvent.keyDown(document, { key: 'Escape' });
      await waitFor(() => {
        expect(screen.queryByTestId('receivable-actions-order-3-menu')).not.toBeInTheDocument();
      });
    });

    it('should render Valor Pendente with muted styling when pending is zero', async () => {
      mockGetImplementation([mockOrders[2]]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('ORD-003')).toBeInTheDocument();
      });
      const pendingCell = rowForOrder('ORD-003').querySelector('td[data-label="Valor Pendente"]');
      expect(pendingCell).toHaveClass('text-gray-400');
      expect(pendingCell).toHaveClass('dark:text-gray-500');
    });

    it('should render Valor Pendente with default styling when pending is positive', async () => {
      mockGetImplementation([mockOrders[0]]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('ORD-001')).toBeInTheDocument();
      });
      const pendingCell = rowForOrder('ORD-001').querySelector('td[data-label="Valor Pendente"]');
      expect(pendingCell).toHaveClass('text-gray-900');
      expect(pendingCell).toHaveClass('dark:text-gray-100');
    });
  });

  describe('Expanded List Columns', () => {
    const rowFor = (orderNumber) => screen.getByText(orderNumber).closest('tr');

    it('should render order date in BR format', async () => {
      mockGetImplementation([mockOrders[0]]);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('ORD-001')).toBeInTheDocument();
      });

      expect(within(rowFor('ORD-001')).getByText('01/08/2026')).toBeInTheDocument();
    });

    it('should render responsible owner', async () => {
      mockGetImplementation([mockOrders[0]]);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('ORD-001')).toBeInTheDocument();
      });

      expect(within(rowFor('ORD-001')).getByText('Ana Silva')).toBeInTheDocument();
    });

    it('should render a dash when responsible owner is absent', async () => {
      mockGetImplementation([mockOrders[1]]);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('ORD-002')).toBeInTheDocument();
      });

      expect(within(rowFor('ORD-002')).getByText('—')).toBeInTheDocument();
    });

    it('should render pending value equal to total when no payments exist', async () => {
      mockGetImplementation([mockOrders[0]]);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('ORD-001')).toBeInTheDocument();
      });

      const row = rowFor('ORD-001');
      expect(within(row).getAllByText(/R\$\s*300,00/)).toHaveLength(2);
    });

    it('should render pending value as total minus paid amount', async () => {
      mockGetImplementation([mockOrders[1]]);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('ORD-002')).toBeInTheDocument();
      });

      expect(within(rowFor('ORD-002')).getByText(/R\$\s*450,00/)).toBeInTheDocument();
    });

    it('should clamp pending value to R$ 0,00 on overpayment', async () => {
      mockGetImplementation([mockOrders[2]]);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('ORD-003')).toBeInTheDocument();
      });

      expect(within(rowFor('ORD-003')).getByText(/R\$\s*0,00/)).toBeInTheDocument();
    });

    it('should render PV Total as the sum of item pv', async () => {
      mockGetImplementation([mockOrders[0]]);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('ORD-001')).toBeInTheDocument();
      });

      expect(within(rowFor('ORD-001')).getByText('15.50')).toBeInTheDocument();
    });

    it('should render description truncated with full text in title', async () => {
      mockGetImplementation([mockOrders[0]]);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('ORD-001')).toBeInTheDocument();
      });

      const desc = within(rowFor('ORD-001')).getByText('Pedido de teste');
      expect(desc).toHaveAttribute('title', 'Pedido de teste');
    });

    it('should render a dash for empty description', async () => {
      mockGetImplementation([mockOrders[2]]);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('ORD-003')).toBeInTheDocument();
      });

      expect(within(rowFor('ORD-003')).getByText('—')).toBeInTheDocument();
    });
  });

  describe('Payment Modal', () => {
    it('should open payment modal and fetch balance when clicking "Registrar Pagamento"', async () => {
      mockGetImplementation([mockOrders[0]]);
      renderPage();
      await openPaymentAction('order-1');

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/orders/order-1/balance');
        expect(screen.getByText(/Registrar Pagamento — ORD-001/)).toBeInTheDocument();
      });
    });

    it('should display person dropdown with pending balances', async () => {
      mockGetImplementation([mockOrders[1]]);
      renderPage();
      await openPaymentAction('order-2');

      await waitFor(() => {
        expect(screen.getByText(/João Silva — Pendente: R\$\s*150,00/)).toBeInTheDocument();
      });
    });

    it('should display "Saldo pendente" for the selected person', async () => {
      mockGetImplementation([mockOrders[0]]);
      renderPage();
      await openPaymentAction('order-1');

      await waitFor(() => {
        expect(screen.getByText(/Saldo pendente:/)).toBeInTheDocument();
      });
    });

    it('should not show "Nenhuma pessoa neste pedido" and list zero-balance persons', async () => {
      mockGetImplementation([mockOrders[3]]);
      renderPage();
      await openPaymentAction('order-4', 'Dar baixa');

      await waitFor(() => {
        expect(screen.getByText(/Registrar Pagamento — ORD-004/)).toBeInTheDocument();
      });

      expect(screen.queryByText('Nenhuma pessoa neste pedido')).not.toBeInTheDocument();
      expect(screen.getByText(/Brinde Person — Nada a receber/)).toBeInTheDocument();
    });

    it('should show "Dar baixa" button and submit a zero payment for a zero-balance person', async () => {
      mockGetImplementation([mockOrders[3]]);
      renderPage();
      await openPaymentAction('order-4', 'Dar baixa');

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
      await openPaymentAction('order-1');

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
      await openPaymentAction('order-1');

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

  describe('Payment Modal — Order Summary Header', () => {
    const openModalFor = async (order) => {
      mockGetImplementation([order]);
      renderPage();
      await openPaymentAction(order.id, order.totalValue === '0.00' ? 'Dar baixa' : 'Registrar Pagamento');

      return within(screen.getByTestId('payment-modal'));
    };

    it('should render all summary labels in the modal', async () => {
      const modal = await openModalFor(mockOrders[0]);

      expect(modal.getByText('Número')).toBeInTheDocument();
      expect(modal.getByText('Data')).toBeInTheDocument();
      expect(modal.getByText('Responsável')).toBeInTheDocument();
      expect(modal.getByText('Valor Total')).toBeInTheDocument();
      expect(modal.getByText('Valor Pendente')).toBeInTheDocument();
      expect(modal.getByText('Descrição')).toBeInTheDocument();
    });

    it('should render order number, date, owner and description values', async () => {
      const modal = await openModalFor(mockOrders[0]);

      expect(modal.getByText('ORD-001')).toBeInTheDocument();
      expect(modal.getByText('01/08/2026')).toBeInTheDocument();
      expect(modal.getByText('Ana Silva')).toBeInTheDocument();
      expect(modal.getByTestId('order-summary-description')).toHaveTextContent('Pedido de teste');
    });

    it('should show pending equal to total when there are no payments', async () => {
      const modal = await openModalFor(mockOrders[0]);

      expect(modal.getByTestId('order-summary-total')).toHaveTextContent(/R\$\s*300,00/);
      expect(modal.getByTestId('order-summary-pending')).toHaveTextContent(/R\$\s*300,00/);
    });

    it('should show pending R$ 0,00 for a zero-value order', async () => {
      const modal = await openModalFor(mockOrders[3]);

      expect(modal.getByTestId('order-summary-total')).toHaveTextContent(/R\$\s*0,00/);
      expect(modal.getByTestId('order-summary-pending')).toHaveTextContent(/R\$\s*0,00/);
    });

    it('should set the title attribute on the description for tooltip', async () => {
      const modal = await openModalFor(mockOrders[0]);

      const desc = modal.getByTestId('order-summary-description');
      expect(desc).toHaveAttribute('title', 'Pedido de teste');
    });

    it('should render a dash when the description is absent', async () => {
      const modal = await openModalFor(mockOrders[3]);

      const desc = modal.getByTestId('order-summary-description');
      expect(desc).toHaveTextContent('—');
      expect(desc).not.toHaveAttribute('title');
    });
  });

  describe('Payment Modal — Per-Person Items', () => {
    const openRichOrderModal = async () => {
      mockGetImplementation([richOrder]);
      renderPage();
      await openPaymentAction('order-rich');

      return within(screen.getByTestId('payment-modal'));
    };

    it('should list the selected person items with description, charged value and details', async () => {
      const modal = await openRichOrderModal();

      expect(modal.getByText('Itens desta pessoa')).toBeInTheDocument();
      expect(modal.getByText('Lemongrass Óleo Essencial 15ml')).toBeInTheDocument();
      expect(modal.getByText(/R\$\s*89,00/)).toBeInTheDocument();
      expect(modal.getByText(/Uso doméstico/)).toBeInTheDocument();
      expect(modal.getByText('On Guard + 30ml')).toBeInTheDocument();
      expect(modal.getByText(/R\$\s*145,56/)).toBeInTheDocument();
    });

    it('should render a dash for items without details', async () => {
      const modal = await openRichOrderModal();

      expect(modal.getByText('On Guard + 30ml')).toBeInTheDocument();
      expect(modal.getByText(/Detalhes: —/)).toBeInTheDocument();
    });

    it('should not show items belonging to other persons', async () => {
      const modal = await openRichOrderModal();

      expect(modal.queryByText('Deep Blue Rub')).not.toBeInTheDocument();
    });

    it('should show only the selected person items when changing the person', async () => {
      const modal = await openRichOrderModal();

      fireEvent.change(modal.getByRole('combobox'), { target: { value: 'p2' } });

      await waitFor(() => {
        expect(modal.getByText('Deep Blue Rub')).toBeInTheDocument();
      });

      expect(modal.queryByText('Lemongrass Óleo Essencial 15ml')).not.toBeInTheDocument();
      expect(modal.queryByText('On Guard + 30ml')).not.toBeInTheDocument();
    });
  });

  describe('Validation Guards', () => {
    const openModalWithBalance = async () => {
      mockGetImplementation([mockOrders[0]]);
      renderPage();
      await openPaymentAction('order-1');
    };

    it('should allow submitting a zero amount for a zero-balance person', async () => {
      mockGetImplementation([mockOrders[3]]);
      renderPage();
      await openPaymentAction('order-4', 'Dar baixa');

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
      await openPaymentAction('order-fp');

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
      await openPaymentAction('order-1');
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

      await openPaymentAction('order-1');

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
      await openPaymentAction('order-1');

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
      await openPaymentAction('order-1');

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
