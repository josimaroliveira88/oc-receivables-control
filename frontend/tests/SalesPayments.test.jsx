import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SalesPage from '../src/pages/SalesPage';
import { ToastProvider } from '../src/components/Toast';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();

vi.mock('../src/services/api', () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    put: (...args) => mockPut(...args),
  },
}));

const mockSale = {
  id: 'sale-1',
  orderNumber: 'V-0001',
  orderDate: '2026-08-01',
  totalValue: '300.00',
  shippingValue: '10.00',
  additionalValue: '5.00',
  deliveredAt: null,
  status: 'PENDENTE',
  orderNotes: 'Venda de teste',
  items: [
    {
      id: 'item-1',
      personId: 'p1',
      person: { id: 'p1', name: 'João Silva' },
      description: 'Adaptiv Pastilhas',
      chargedValue: '200.00',
      quantity: 1,
      chargedValueMode: 'UNIT',
    },
    {
      id: 'item-2',
      personId: 'p1',
      person: { id: 'p1', name: 'João Silva' },
      description: 'Óleo de Lavanda',
      chargedValue: '85.00',
      quantity: 1,
      chargedValueMode: 'UNIT',
    },
  ],
  payments: [],
};

const zeroSale = {
  id: 'sale-zero',
  orderNumber: 'V-0000',
  orderDate: '2026-08-03',
  totalValue: '0.00',
  shippingValue: '0',
  additionalValue: '0',
  deliveredAt: null,
  status: 'PENDENTE',
  orderNotes: null,
  items: [
    {
      id: 'item-z',
      personId: 'p1',
      person: { id: 'p1', name: 'João Silva' },
      description: 'Brinde',
      chargedValue: '0.00',
      quantity: 1,
      chargedValueMode: 'UNIT',
    },
  ],
  payments: [],
};

const detailSale = {
  id: 'sale-detail',
  orderNumber: 'V-0002',
  orderDate: '2026-08-05',
  totalValue: '300.00',
  shippingValue: '10.00',
  additionalValue: '5.00',
  deliveredAt: null,
  status: 'PARCIAL',
  orderNotes: 'Detalhes da venda',
  items: [
    {
      id: 'detail-item-1',
      personId: 'p1',
      person: { id: 'p1', name: 'João Silva' },
      product: { name: 'Adaptiv Pastilhas' },
      description: 'Adaptiv Pastilhas',
      chargedValue: '200.00',
      quantity: 1,
      chargedValueMode: 'UNIT',
    },
    {
      id: 'detail-item-2',
      personId: 'p1',
      person: { id: 'p1', name: 'João Silva' },
      product: { name: 'Óleo de Lavanda' },
      description: 'Óleo de Lavanda',
      chargedValue: '85.00',
      quantity: 1,
      chargedValueMode: 'UNIT',
    },
  ],
  payments: [
    {
      id: 'pay-1',
      personId: 'p1',
      person: { id: 'p1', name: 'João Silva' },
      amount: '100.00',
      paidAt: '2026-08-06T12:00:00.000Z',
      paymentType: 'PIX',
      notes: 'Pix recebido',
    },
  ],
};

const mockBalances = {
  'sale-1': {
    balances: [
      {
        personId: 'p1',
        personName: 'João Silva',
        isSelf: false,
        itemTotal: '300.00',
        paymentTotal: '0.00',
        pending: '300.00',
      },
    ],
  },
  'sale-zero': {
    balances: [
      {
        personId: 'p1',
        personName: 'João Silva',
        isSelf: false,
        itemTotal: '0.00',
        paymentTotal: '0.00',
        pending: '0.00',
      },
    ],
  },
  'sale-detail': {
    balances: [
      {
        personId: 'p1',
        personName: 'João Silva',
        isSelf: false,
        itemTotal: '300.00',
        paymentTotal: '100.00',
        pending: '200.00',
      },
    ],
  },
};

const mockGetImplementation = (salesData = []) => {
  mockGet.mockImplementation((url) => {
    if (url === '/sales') return Promise.resolve({ data: salesData });
    if (url === '/people') return Promise.resolve({ data: [] });
    if (url.startsWith('/products'))
      return Promise.resolve({ data: { data: [] } });
    const balanceMatch = url.match(/^\/orders\/(.+)\/balance$/);
    if (balanceMatch) {
      const saleId = balanceMatch[1];
      return Promise.resolve({
        data: mockBalances[saleId] || { balances: [] },
      });
    }
    return Promise.resolve({ data: [] });
  });
};

const renderPage = () => {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <SalesPage />
      </ToastProvider>
    </MemoryRouter>,
  );
};

const openSaleActionsMenu = async (saleId) => {
  await waitFor(() => {
    expect(
      screen.getByTestId(`sale-actions-${saleId}-trigger`),
    ).toBeInTheDocument();
  });
  fireEvent.click(screen.getByTestId(`sale-actions-${saleId}-trigger`));
  await waitFor(() => {
    expect(
      screen.getByTestId(`sale-actions-${saleId}-menu`),
    ).toBeInTheDocument();
  });
};

const openPaymentAction = async (saleId, label = 'Registrar-Pagamento') => {
  await openSaleActionsMenu(saleId);
  fireEvent.click(screen.getByTestId(`sale-actions-${saleId}-item-${label}`));
  await waitFor(() => {
    expect(screen.getByTestId('sale-payment-modal')).toBeInTheDocument();
  });
};

const openDetailsAction = async (saleId) => {
  await openSaleActionsMenu(saleId);
  fireEvent.click(
    screen.getByTestId(`sale-actions-${saleId}-item-Detalhar-Pagamentos`),
  );
  await waitFor(() => {
    expect(screen.getByTestId('sale-details-modal')).toBeInTheDocument();
  });
};

describe('SalesPayments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Payment Modal', () => {
    it('should open the payment modal and fetch the balance', async () => {
      mockGetImplementation([mockSale]);
      renderPage();
      await openPaymentAction('sale-1');
      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/orders/sale-1/balance');
        expect(
          screen.getByText('Registrar Pagamento — V-0001'),
        ).toBeInTheDocument();
      });
    });

    it('should show the fixed client without a person select', async () => {
      mockGetImplementation([mockSale]);
      renderPage();
      await openPaymentAction('sale-1');
      const modal = within(screen.getByTestId('sale-payment-modal'));
      expect(modal.getByText('Cliente')).toBeInTheDocument();
      expect(modal.getByText('João Silva')).toBeInTheDocument();
      expect(
        modal.queryByText(/João Silva — Pendente:/),
      ).not.toBeInTheDocument();
    });

    it('should render the summary header with sale fields', async () => {
      mockGetImplementation([mockSale]);
      renderPage();
      await openPaymentAction('sale-1');
      const modal = within(screen.getByTestId('sale-payment-modal'));
      expect(modal.getByText('Nº Venda')).toBeInTheDocument();
      expect(modal.getByText('Data')).toBeInTheDocument();
      expect(modal.getByText('Valor Total')).toBeInTheDocument();
      expect(modal.getByText('Frete')).toBeInTheDocument();
      expect(modal.getByText('Valores Adicionais')).toBeInTheDocument();
      expect(modal.getByText('Valor Pendente')).toBeInTheDocument();
      expect(modal.getByText('Descrição')).toBeInTheDocument();
      expect(modal.getByTestId('sale-summary-total')).toHaveTextContent(
        /R\$\s*300,00/,
      );
      expect(modal.getByTestId('sale-summary-shipping')).toHaveTextContent(
        /R\$\s*10,00/,
      );
      expect(modal.getByTestId('sale-summary-additional')).toHaveTextContent(
        /R\$\s*5,00/,
      );
      expect(modal.getByTestId('sale-summary-pending')).toHaveTextContent(
        /R\$\s*300,00/,
      );
      expect(modal.getByTestId('sale-summary-description')).toHaveTextContent(
        'Venda de teste',
      );
    });

    it('should list the client items in the modal', async () => {
      mockGetImplementation([mockSale]);
      renderPage();
      await openPaymentAction('sale-1');
      const modal = within(screen.getByTestId('sale-payment-modal'));
      expect(modal.getByText('Itens desta pessoa')).toBeInTheDocument();
      expect(modal.getByText('Adaptiv Pastilhas')).toBeInTheDocument();
      expect(modal.getByText('Óleo de Lavanda')).toBeInTheDocument();
    });

    it('should include a "Forma de Pagamento" select with all options', async () => {
      mockGetImplementation([mockSale]);
      renderPage();
      await openPaymentAction('sale-1');
      const select = screen.getByLabelText('Forma de Pagamento');
      expect(select).toBeInTheDocument();
      expect(select.value).toBe('');
      expect(
        screen.getByRole('option', { name: 'Não informada' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'PIX' })).toBeInTheDocument();
      expect(
        screen.getByRole('option', { name: 'Boleto' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('option', { name: 'Cartão de Crédito' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('option', { name: 'InfinitePay' }),
      ).toBeInTheDocument();
    });

    it('should send paymentType in the create payload when selected', async () => {
      mockGetImplementation([mockSale]);
      mockPost.mockResolvedValue({
        data: { id: 'pay-1', amount: '100.00', personId: 'p1' },
      });
      renderPage();
      await openPaymentAction('sale-1');

      fireEvent.change(screen.getByPlaceholderText('0,00'), {
        target: { value: '10000' },
      });
      fireEvent.change(screen.getByLabelText('Forma de Pagamento'), {
        target: { value: 'PIX' },
      });
      const form = screen.getByPlaceholderText('0,00').closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/orders/sale-1/payments', {
          amount: 100,
          personId: 'p1',
          paidAt: expect.any(String),
          notes: undefined,
          paymentType: 'PIX',
        });
      });
    });

    it('should omit paymentType in the create payload when not informed', async () => {
      mockGetImplementation([mockSale]);
      mockPost.mockResolvedValue({
        data: { id: 'pay-1', amount: '100.00', personId: 'p1' },
      });
      renderPage();
      await openPaymentAction('sale-1');

      fireEvent.change(screen.getByPlaceholderText('0,00'), {
        target: { value: '10000' },
      });
      const form = screen.getByPlaceholderText('0,00').closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/orders/sale-1/payments', {
          amount: 100,
          personId: 'p1',
          paidAt: expect.any(String),
          notes: undefined,
        });
      });
      const [, payload] = mockPost.mock.calls[0];
      expect(payload).not.toHaveProperty('paymentType');
    });

    it('should ask for overpayment confirmation and submit when confirmed', async () => {
      mockGetImplementation([mockSale]);
      mockPost.mockResolvedValue({
        data: { id: 'pay-over', amount: '999.00' },
      });
      renderPage();
      await openPaymentAction('sale-1');

      fireEvent.change(screen.getByPlaceholderText('0,00'), {
        target: { value: '99900' },
      });
      const form = screen.getByPlaceholderText('0,00').closest('form');
      fireEvent.submit(form);

      const dialog = await screen.findByRole('dialog');
      expect(
        within(dialog).getByText(/maior que o saldo pendente/),
      ).toBeInTheDocument();
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Confirmar recebimento' }),
      );

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/orders/sale-1/payments', {
          amount: 999,
          personId: 'p1',
          paidAt: expect.any(String),
          notes: undefined,
        });
      });
    });

    it('should allow a zero payment for a zero-value sale ("Dar baixa")', async () => {
      mockGetImplementation([zeroSale]);
      renderPage();
      await openPaymentAction('sale-zero', 'Dar-baixa');

      await waitFor(() => {
        expect(
          screen.getByText(/Nada a receber — baixa sem valor/),
        ).toBeInTheDocument();
      });
      expect(screen.getByText('Dar baixa')).toBeInTheDocument();

      const amountInput = screen.getByPlaceholderText('0,00');
      const form = amountInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/orders/sale-zero/payments', {
          amount: 0,
          personId: 'p1',
          paidAt: expect.any(String),
          notes: undefined,
        });
      });
    });

    it('should strip the minus sign from the amount instead of allowing negatives', async () => {
      mockGetImplementation([mockSale]);
      renderPage();
      await openPaymentAction('sale-1');

      const amountInput = screen.getByPlaceholderText('0,00');
      fireEvent.change(amountInput, { target: { value: '-10' } });

      await waitFor(() => {
        expect(amountInput).toHaveValue('0,10');
      });
      expect(
        screen.queryByText('Valor não pode ser negativo'),
      ).not.toBeInTheDocument();
    });
  });

  describe('Details Modal', () => {
    it('should open the details modal with sale summary and client row', async () => {
      mockGetImplementation([detailSale]);
      renderPage();
      await openDetailsAction('sale-detail');

      const modal = within(screen.getByTestId('sale-details-modal'));
      expect(modal.getByText('Detalhamento — V-0002')).toBeInTheDocument();
      expect(modal.getByText('Nº Venda')).toBeInTheDocument();
      expect(modal.getByText('Cliente')).toBeInTheDocument();
      expect(modal.getByText('Valores Adicionais')).toBeInTheDocument();
      expect(
        modal.getByTestId('sale-details-summary-additional'),
      ).toHaveTextContent(/R\$\s*5,00/);
      expect(
        modal.getByTestId('sale-details-summary-pending'),
      ).toHaveTextContent(/R\$\s*200,00/);
      expect(modal.getByTestId('detail-person-p1')).toHaveTextContent(
        'João Silva',
      );
    });

    it('should show the payment type badge on the payment row', async () => {
      mockGetImplementation([detailSale]);
      renderPage();
      await openDetailsAction('sale-detail');
      const modal = within(screen.getByTestId('sale-details-modal'));
      fireEvent.click(modal.getByTestId('detail-person-p1'));
      expect(modal.getByTestId('detail-panel-p1')).toBeInTheDocument();
      expect(modal.getByText('Pagamentos recebidos')).toBeInTheDocument();
      expect(modal.getByTestId('payment-badge-pay-1')).toHaveTextContent('PIX');
    });
  });

  describe('Edit Payment', () => {
    const openEditModal = async () => {
      mockGetImplementation([detailSale]);
      renderPage();
      await openDetailsAction('sale-detail');
      const modal = within(screen.getByTestId('sale-details-modal'));
      fireEvent.click(modal.getByTestId('detail-person-p1'));
      fireEvent.click(modal.getByTestId('edit-payment-pay-1'));
      await waitFor(() => {
        expect(
          screen.getByTestId('sale-edit-payment-modal'),
        ).toBeInTheDocument();
      });
      return within(screen.getByTestId('sale-edit-payment-modal'));
    };

    it('should open the edit modal pre-filled with the payment data', async () => {
      const editModal = await openEditModal();
      expect(
        editModal.getByText('Editar Pagamento — V-0002'),
      ).toBeInTheDocument();
      expect(editModal.getByDisplayValue('100,00')).toBeInTheDocument();
      expect(editModal.getByDisplayValue('2026-08-06')).toBeInTheDocument();
      expect(editModal.getByDisplayValue('Pix recebido')).toBeInTheDocument();
      expect(editModal.getByLabelText('Forma de Pagamento').value).toBe('PIX');
    });

    it('should update amount, date, notes and payment type', async () => {
      const editModal = await openEditModal();
      fireEvent.change(editModal.getByDisplayValue('100,00'), {
        target: { value: '12000' },
      });
      fireEvent.change(editModal.getByDisplayValue('2026-08-06'), {
        target: { value: '2026-08-08' },
      });
      fireEvent.change(editModal.getByDisplayValue('Pix recebido'), {
        target: { value: 'Pix atualizado' },
      });
      mockPut.mockResolvedValue({
        data: {
          payment: { id: 'pay-1', amount: '120.00', paymentType: 'BOLETO' },
        },
      });
      fireEvent.change(editModal.getByLabelText('Forma de Pagamento'), {
        target: { value: 'BOLETO' },
      });

      fireEvent.submit(
        screen.getByTestId('sale-edit-payment-modal').querySelector('form'),
      );

      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith('/orders/payments/pay-1', {
          amount: 120,
          paidAt: '2026-08-08',
          notes: 'Pix atualizado',
          paymentType: 'BOLETO',
        });
      });
    });

    it('should clear the payment type when "Não informada" is selected', async () => {
      const editModal = await openEditModal();
      fireEvent.change(editModal.getByLabelText('Forma de Pagamento'), {
        target: { value: '' },
      });
      mockPut.mockResolvedValue({
        data: { payment: { id: 'pay-1', amount: '100.00', paymentType: null } },
      });
      fireEvent.submit(
        screen.getByTestId('sale-edit-payment-modal').querySelector('form'),
      );
      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith('/orders/payments/pay-1', {
          amount: 100,
          paidAt: '2026-08-06',
          notes: 'Pix recebido',
          paymentType: null,
        });
      });
    });

    it('should require overpayment confirmation when the edited amount exceeds pending', async () => {
      const editModal = await openEditModal();
      fireEvent.change(editModal.getByDisplayValue('100,00'), {
        target: { value: '50000' },
      });
      mockPut.mockResolvedValue({ data: {} });
      fireEvent.submit(
        screen.getByTestId('sale-edit-payment-modal').querySelector('form'),
      );
      const dialog = await screen.findByRole('dialog');
      expect(mockPut).not.toHaveBeenCalled();
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Confirmar atualização' }),
      );
      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledTimes(1);
      });
    });
  });
});
