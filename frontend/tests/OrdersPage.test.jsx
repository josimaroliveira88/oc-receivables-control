import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
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

const mockOrders = [
  {
    id: '1',
    orderNumber: 'ORD-001',
    orderDate: '2026-05-15T00:00:00.000Z',
    totalValue: '300.00',
    status: 'PENDENTE',
    accountOwner: '6254862 - Ana Silva',
    paymentType: 'PIX',
    orderNotes: 'Pedido de promoção de março',
    items: [
      {
        id: 'i1',
        description: 'Item 1',
        chargedValue: '100.00',
        personId: 'p1',
        person: { name: 'João' },
        productId: 'prod-1',
        memberPrice: '90.00',
        pv: '15',
      },
      {
        id: 'i2',
        description: 'Item 2',
        chargedValue: '200.00',
        personId: 'p1',
        person: { name: 'João' },
        productId: 'prod-2',
        memberPrice: '180.00',
        pv: '30',
      },
    ],
  },
  {
    id: '2',
    orderNumber: 'ORD-002',
    orderDate: '2026-06-20T00:00:00.000Z',
    totalValue: '500.00',
    status: 'QUITADO',
    accountOwner: null,
    paymentType: null,
    orderNotes: null,
    items: [
      {
        id: 'i3',
        description: 'Item 3',
        chargedValue: '500.00',
        personId: 'p2',
        person: { name: 'Maria' },
        productId: null,
        memberPrice: null,
        pv: null,
      },
    ],
  },
];

const mockPeople = [
  { id: 'p1', name: 'João Silva', contact: 'joao@email.com' },
  { id: 'p2', name: 'Maria Santos', contact: 'maria@email.com' },
];

const mockProducts = [
  {
    id: 'prod-1',
    name: 'Adaptiv Pastilhas',
    code: '60226006',
    memberPrice: '90.00',
    pv: '15',
    status: 'ATIVO',
  },
  {
    id: 'prod-2',
    name: 'Óleo de Lavanda',
    code: '60226007',
    memberPrice: '180.00',
    pv: '30',
    status: 'ATIVO',
  },
  {
    id: 'prod-3',
    name: 'Menta Verde',
    code: '60226008',
    memberPrice: '50.00',
    pv: '8',
    status: 'INDISPONIVEL',
  },
];

const mockGetImplementation = (ordersData = [], peopleData = mockPeople) => {
  mockGet.mockImplementation((url) => {
    if (url === '/orders') return Promise.resolve({ data: ordersData });
    if (url === '/people') return Promise.resolve({ data: peopleData });
    if (url.startsWith('/products'))
      return Promise.resolve({ data: { data: mockProducts } });
    return Promise.resolve({ data: [] });
  });
};

const renderPage = () => {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <OrdersPage />
      </ToastProvider>
    </MemoryRouter>,
  );
};

const openOrderActionsMenu = async (orderId) => {
  await waitFor(() => {
    expect(
      screen.getByTestId(`order-actions-${orderId}-trigger`),
    ).toBeInTheDocument();
  });
  fireEvent.click(screen.getByTestId(`order-actions-${orderId}-trigger`));
  await waitFor(() => {
    expect(
      screen.getByTestId(`order-actions-${orderId}-menu`),
    ).toBeInTheDocument();
  });
};

const clickOrderAction = async (orderId, label) => {
  await openOrderActionsMenu(orderId);
  fireEvent.click(screen.getByTestId(`order-actions-${orderId}-item-${label}`));
};

describe('OrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the page title "Gestão de Pedidos"', async () => {
      mockGetImplementation([]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Gestão de Pedidos')).toBeInTheDocument();
      });
    });

    it('should render "Novo Pedido" button', async () => {
      mockGetImplementation([]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });
    });

    it('should show empty state when no orders exist', async () => {
      mockGetImplementation([]);
      renderPage();
      await waitFor(() => {
        expect(
          screen.getByText('Nenhum pedido cadastrado'),
        ).toBeInTheDocument();
      });
    });

    it('should show loading state', () => {
      mockGet.mockImplementation(() => new Promise(() => {}));
      renderPage();
      expect(screen.getByText('Carregando...')).toBeInTheDocument();
    });
  });

  describe('Orders List', () => {
    beforeEach(() => {
      mockGetImplementation(mockOrders);
    });

    it('should display orders in a table', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('ORD-001')).toBeInTheDocument();
        expect(screen.getByText('ORD-002')).toBeInTheDocument();
      });
    });

    it('should display order total values', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByText(/R\$\s*300,00/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/R\$\s*500,00/).length).toBeGreaterThan(0);
      });
    });

    it('should display status badges', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Pendente')).toBeInTheDocument();
        expect(screen.getByText('Quitado')).toBeInTheDocument();
      });
    });

    it('should display an actions kebab trigger for each order', async () => {
      renderPage();
      await waitFor(() => {
        const triggers = screen.getAllByTestId(/^order-actions-\d+-trigger$/);
        expect(triggers).toHaveLength(2);
      });
    });

    it('should not show menu items until the trigger is clicked', async () => {
      renderPage();
      await waitFor(() => {
        expect(
          screen.getByTestId('order-actions-1-trigger'),
        ).toBeInTheDocument();
      });
      expect(
        screen.queryByTestId('order-actions-1-menu'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('order-actions-1-item-Editar'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('order-actions-1-item-Excluir'),
      ).not.toBeInTheDocument();
    });

    it('should open the menu with Editar and Excluir items when the kebab is clicked', async () => {
      renderPage();
      await waitFor(() => {
        expect(
          screen.getByTestId('order-actions-1-trigger'),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('order-actions-1-trigger'));

      await waitFor(() => {
        expect(screen.getByTestId('order-actions-1-menu')).toBeInTheDocument();
        expect(
          screen.getByTestId('order-actions-1-item-Editar'),
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('order-actions-1-item-Excluir'),
        ).toBeInTheDocument();
      });
    });

    it('should mark the Excluir item with danger styling', async () => {
      renderPage();
      await waitFor(() => {
        expect(
          screen.getByTestId('order-actions-1-trigger'),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('order-actions-1-trigger'));

      await waitFor(() => {
        const deleteItem = screen.getByTestId('order-actions-1-item-Excluir');
        expect(deleteItem.className).toMatch(/text-red-600/);
        expect(deleteItem.className).toMatch(/hover:bg-red/);
      });
    });

    it('should expose menu semantics via aria attributes on the trigger', async () => {
      renderPage();
      await waitFor(() => {
        const trigger = screen.getByTestId('order-actions-1-trigger');
        expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
      });

      fireEvent.click(screen.getByTestId('order-actions-1-trigger'));

      await waitFor(() => {
        const trigger = screen.getByTestId('order-actions-1-trigger');
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('menu')).toBeInTheDocument();
        const items = screen.getAllByRole('menuitem');
        expect(items).toHaveLength(4);
      });
    });

    it('should close the menu when clicking the backdrop', async () => {
      renderPage();
      await waitFor(() => {
        expect(
          screen.getByTestId('order-actions-1-trigger'),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('order-actions-1-trigger'));

      await waitFor(() => {
        expect(screen.getByTestId('order-actions-1-menu')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('order-actions-1-backdrop'));

      await waitFor(() => {
        expect(
          screen.queryByTestId('order-actions-1-menu'),
        ).not.toBeInTheDocument();
      });
    });

    it('should close the menu when pressing Escape', async () => {
      renderPage();
      await waitFor(() => {
        expect(
          screen.getByTestId('order-actions-1-trigger'),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('order-actions-1-trigger'));

      await waitFor(() => {
        expect(screen.getByTestId('order-actions-1-menu')).toBeInTheDocument();
      });

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(
          screen.queryByTestId('order-actions-1-menu'),
        ).not.toBeInTheDocument();
      });
    });

    it('should close the menu after selecting an item', async () => {
      renderPage();
      await waitFor(() => {
        expect(
          screen.getByTestId('order-actions-1-trigger'),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('order-actions-1-trigger'));
      fireEvent.click(screen.getByTestId('order-actions-1-item-Editar'));

      await waitFor(() => {
        expect(
          screen.queryByTestId('order-actions-1-menu'),
        ).not.toBeInTheDocument();
      });
    });

    it('should display "Data" column header', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Data')).toBeInTheDocument();
      });
    });

    it('should display order dates formatted as DD/MM/YYYY', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('15/05/2026')).toBeInTheDocument();
        expect(screen.getByText('20/06/2026')).toBeInTheDocument();
      });
    });

    it('should display account owner column', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('6254862 - Ana Silva')).toBeInTheDocument();
      });
    });

    it('should display payment type badges', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('PIX')).toBeInTheDocument();
      });
    });

    it('should display total PV per order', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('45.00')).toBeInTheDocument();
        expect(screen.getByText('0.00')).toBeInTheDocument();
      });
    });

    it('should display order notes in description column', async () => {
      renderPage();
      await waitFor(() => {
        expect(
          screen.getByText('Pedido de promoção de março'),
        ).toBeInTheDocument();
      });
    });

    it('should display tracking links for each order', async () => {
      renderPage();
      await waitFor(() => {
        const links = screen.getAllByTitle('Ver pedido no site');
        expect(links).toHaveLength(2);
        expect(links[0]).toHaveTextContent('ORD-001');
        expect(links[1]).toHaveTextContent('ORD-002');
        expect(links[0]).toHaveAttribute(
          'href',
          'https://status.ondeestameupedido.com/tracking/22747/ORD-001/',
        );
        expect(links[1]).toHaveAttribute(
          'href',
          'https://status.ondeestameupedido.com/tracking/22747/ORD-002/',
        );
      });
    });

    it('should not render a separate tracking column', async () => {
      renderPage();
      await waitFor(() => {
        expect(
          screen.queryByRole('columnheader', { name: 'Rastreio' }),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Create Order Modal', () => {
    beforeEach(() => {
      mockGetImplementation([]);
    });

    it('should open create modal when clicking "Novo Pedido"', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo Pedido'));

      await waitFor(() => {
        expect(screen.getByText('Itens do Pedido')).toBeInTheDocument();
      });
    });

    it('should display "Adicionar Item" button in the modal', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo Pedido'));

      await waitFor(() => {
        expect(screen.getByText('Adicionar Item')).toBeInTheDocument();
      });
    });

    it('should add a new item row when clicking "Adicionar Item"', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo Pedido'));

      await waitFor(() => {
        expect(screen.getByText('Adicionar Item')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Adicionar Item'));

      await waitFor(() => {
        expect(screen.getByText('Item 1')).toBeInTheDocument();
        expect(screen.getByText('Item 2')).toBeInTheDocument();
      });
    });

    it('should remove an item row when clicking "Remover"', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo Pedido'));

      await waitFor(() => {
        expect(screen.getByText('Adicionar Item')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Adicionar Item'));

      await waitFor(() => {
        const removeButtons = screen.getAllByText('Remover');
        expect(removeButtons).toHaveLength(2);
      });

      const removeButtons = screen.getAllByText('Remover');
      fireEvent.click(removeButtons[1]);

      await waitFor(() => {
        expect(screen.queryByText('Item 2')).not.toBeInTheDocument();
      });
    });

    it('should display person dropdown in item row', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo Pedido'));

      await waitFor(() => {
        expect(screen.getByText('Selecione uma pessoa')).toBeInTheDocument();
      });
    });

    it('should show validation error when submitting incomplete form', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo Pedido'));

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
        ).toBeInTheDocument();
      });

      const form = screen
        .getByPlaceholderText('Informe o número do pedido da dōTERRA')
        .closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(
          within(screen.getByTestId('order-number-error')).getByText(
            'Número do pedido é obrigatório',
          ),
        ).toBeInTheDocument();
      });
    });

    it('should close modal when clicking "Cancelar"', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo Pedido'));

      await waitFor(() => {
        expect(screen.getByText('Cancelar')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Cancelar'));

      await waitFor(() => {
        expect(screen.queryByText('Cancelar')).not.toBeInTheDocument();
      });
    });

    it('should display "Data do Pedido" field in create modal', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo Pedido'));

      await waitFor(() => {
        expect(screen.getByLabelText('Data do Pedido')).toBeInTheDocument();
      });
    });

    it("should pre-fill date field with today's date in create modal", async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo Pedido'));

      await waitFor(() => {
        const dateInput = screen.getByLabelText('Data do Pedido');
        expect(dateInput.value).not.toBe('');
      });
    });

    it('should send orderDate when creating an order', async () => {
      mockPost.mockResolvedValue({ data: { id: '3', orderNumber: 'ORD-003' } });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo Pedido'));

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
        ).toBeInTheDocument();
      });

      fireEvent.change(
        screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
        { target: { value: 'ORD-NEW' } },
      );
      fireEvent.change(screen.getByLabelText('Data do Pedido'), {
        target: { value: '2026-03-10' },
      });

      const valueInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(valueInput, { target: { value: '150' } });
      const personSelect = screen.getByDisplayValue('Selecione uma pessoa');
      fireEvent.change(personSelect, { target: { value: 'p1' } });

      const form = screen
        .getByPlaceholderText('Informe o número do pedido da dōTERRA')
        .closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          '/orders',
          expect.objectContaining({
            orderDate: '2026-03-10',
          }),
        );
      });
    });

    it('should display "Responsável pela conta" field in create modal', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo Pedido'));

      await waitFor(() => {
        expect(
          screen.getByLabelText('Responsável pela conta (ID dōTERRA ou nome)'),
        ).toBeInTheDocument();
      });
    });

    it('should display "Tipo de Pagamento" dropdown with all options', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo Pedido'));

      await waitFor(() => {
        const select = screen.getByLabelText('Tipo de Pagamento');
        expect(select).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'PIX' })).toBeInTheDocument();
        expect(
          screen.getByRole('option', { name: 'Boleto' }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole('option', { name: 'Cartão de Crédito' }),
        ).toBeInTheDocument();
      });
    });

    it('should display "Descrição do Pedido" textarea in create modal', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo Pedido'));

      await waitFor(() => {
        expect(
          screen.getByLabelText('Descrição do Pedido'),
        ).toBeInTheDocument();
      });
    });

    it('should display order notes character counter', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo Pedido'));

      await waitFor(() => {
        expect(screen.getAllByText('0/500')).toHaveLength(2);
      });

      fireEvent.change(screen.getByLabelText('Descrição do Pedido'), {
        target: { value: 'Promoção' },
      });

      await waitFor(() => {
        expect(screen.getByText('8/500')).toBeInTheDocument();
      });
    });

    it('should show tracking link after blurring the order number field', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo Pedido'));

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
        ).toBeInTheDocument();
      });

      expect(screen.queryByText('Ver pedido no site')).not.toBeInTheDocument();

      const numberInput = screen.getByPlaceholderText(
        'Informe o número do pedido da dōTERRA',
      );
      fireEvent.change(numberInput, { target: { value: '12345' } });

      expect(screen.queryByText('Ver pedido no site')).not.toBeInTheDocument();

      fireEvent.blur(numberInput);

      await waitFor(() => {
        const link = screen.getByText('Ver pedido no site');
        expect(link).toHaveAttribute(
          'href',
          'https://status.ondeestameupedido.com/tracking/22747/12345/',
        );
      });
    });

    it('should not show tracking link when order number is empty', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo Pedido'));

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
        ).toBeInTheDocument();
      });

      const numberInput = screen.getByPlaceholderText(
        'Informe o número do pedido da dōTERRA',
      );
      fireEvent.change(numberInput, { target: { value: '   ' } });
      fireEvent.blur(numberInput);

      await waitFor(() => {
        expect(
          screen.queryByText('Ver pedido no site'),
        ).not.toBeInTheDocument();
      });
    });

    it('should display "Soma dos Produtos" and "Soma dos PV" summary', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo Pedido'));

      await waitFor(() => {
        expect(
          screen.getByText('Soma dos Produtos (Valor Cobrado)'),
        ).toBeInTheDocument();
        expect(screen.getByText('Soma dos PV')).toBeInTheDocument();
        expect(screen.getByText('0.00')).toBeInTheDocument();
      });
    });

    it('should update summary totals when filling item values', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo Pedido'));

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Busque um produto...'),
        ).toBeInTheDocument();
      });

      const combobox = screen.getByPlaceholderText('Busque um produto...');
      fireEvent.change(combobox, { target: { value: 'Lavanda' } });
      fireEvent.mouseDown(screen.getByText(/Óleo de Lavanda/));

      await waitFor(() => {
        expect(screen.getByDisplayValue('30')).toBeInTheDocument();
      });

      const valueInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(valueInput, { target: { value: '175' } });

      await waitFor(() => {
        expect(screen.getByText(/R\$\s*175,00/)).toBeInTheDocument();
      });
      expect(screen.getByText('30.00')).toBeInTheDocument();
    });

    it('should send accountOwner, paymentType and orderNotes in create payload', async () => {
      mockPost.mockResolvedValue({
        data: { id: '3', orderNumber: 'ORD-DESC' },
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo Pedido'));

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
        ).toBeInTheDocument();
      });

      fireEvent.change(
        screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
        { target: { value: 'ORD-DESC' } },
      );
      fireEvent.change(
        screen.getByLabelText('Responsável pela conta (ID dōTERRA ou nome)'),
        { target: { value: 'Ana Silva' } },
      );
      fireEvent.change(screen.getByLabelText('Tipo de Pagamento'), {
        target: { value: 'PIX' },
      });
      fireEvent.change(screen.getByLabelText('Descrição do Pedido'), {
        target: { value: 'Promoção de março' },
      });

      const valueInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(valueInput, { target: { value: '150' } });
      const personSelect = screen.getByDisplayValue('Selecione uma pessoa');
      fireEvent.change(personSelect, { target: { value: 'p1' } });

      const form = screen
        .getByPlaceholderText('Informe o número do pedido da dōTERRA')
        .closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          '/orders',
          expect.objectContaining({
            accountOwner: 'Ana Silva',
            paymentType: 'PIX',
            orderNotes: 'Promoção de março',
          }),
        );
      });
    });

    it('should send null for empty optional descriptive fields', async () => {
      mockPost.mockResolvedValue({
        data: { id: '3', orderNumber: 'ORD-EMPTY' },
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo Pedido'));

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
        ).toBeInTheDocument();
      });

      fireEvent.change(
        screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
        { target: { value: 'ORD-EMPTY' } },
      );

      const valueInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(valueInput, { target: { value: '50' } });
      const personSelect = screen.getByDisplayValue('Selecione uma pessoa');
      fireEvent.change(personSelect, { target: { value: 'p1' } });

      const form = screen
        .getByPlaceholderText('Informe o número do pedido da dōTERRA')
        .closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          '/orders',
          expect.objectContaining({
            accountOwner: null,
            paymentType: null,
            orderNotes: null,
          }),
        );
      });
    });
  });

  describe('Product combobox in item row', () => {
    beforeEach(() => {
      mockGetImplementation([]);
    });

    const openModal = async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Novo Pedido'));
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Busque um produto...'),
        ).toBeInTheDocument();
      });
    };

    it('should display product combobox in item row', async () => {
      await openModal();
      expect(
        screen.getByPlaceholderText('Busque um produto...'),
      ).toBeInTheDocument();
    });

    it('should filter products by name in combobox', async () => {
      await openModal();
      const combobox = screen.getByPlaceholderText('Busque um produto...');
      fireEvent.change(combobox, { target: { value: 'Lavanda' } });

      await waitFor(() => {
        expect(screen.getByText(/Óleo de Lavanda/)).toBeInTheDocument();
      });
      expect(screen.queryByText(/Adaptiv Pastilhas/)).not.toBeInTheDocument();
    });

    it('should list INDISPONIVEL products in the combobox', async () => {
      await openModal();
      const combobox = screen.getByPlaceholderText('Busque um produto...');
      fireEvent.change(combobox, { target: { value: 'Menta' } });

      await waitFor(() => {
        expect(screen.getByText(/Menta Verde/)).toBeInTheDocument();
      });
    });

    it('should fetch available products (available=true)', async () => {
      await openModal();
      const productsCall = mockGet.mock.calls.find(([url]) =>
        url.startsWith('/products'),
      );
      expect(productsCall[0]).toContain('available=true');
    });

    it('should not show "Limpar produto" before selecting a product', async () => {
      await openModal();
      expect(screen.queryByText('Limpar produto')).not.toBeInTheDocument();
    });

    it('should auto-fill member price and PV when selecting a product', async () => {
      await openModal();
      const combobox = screen.getByPlaceholderText('Busque um produto...');
      fireEvent.change(combobox, { target: { value: 'Lavanda' } });
      fireEvent.mouseDown(screen.getByText(/Óleo de Lavanda/));

      await waitFor(() => {
        expect(
          screen.getAllByDisplayValue(/R\$\s*180,00/).length,
        ).toBeGreaterThanOrEqual(1);
      });
      expect(screen.getByDisplayValue('30')).toBeInTheDocument();
      expect(screen.getByText('Limpar produto')).toBeInTheDocument();
    });

    it('should clear product and its snapshot fields when clicking "Limpar produto"', async () => {
      await openModal();
      const combobox = screen.getByPlaceholderText('Busque um produto...');
      fireEvent.change(combobox, { target: { value: 'Lavanda' } });
      fireEvent.mouseDown(screen.getByText(/Óleo de Lavanda/));

      await waitFor(() => {
        expect(screen.getByText('Limpar produto')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Limpar produto'));

      await waitFor(() => {
        expect(screen.queryByText('Limpar produto')).not.toBeInTheDocument();
      });
      expect(screen.getByPlaceholderText('Busque um produto...').value).toBe(
        '',
      );
    });

    it('should send productId, chargedValue, memberPrice, pv and details in payload', async () => {
      mockPost.mockResolvedValue({ data: { id: '3', orderNumber: 'ORD-ENH' } });
      await openModal();

      fireEvent.change(
        screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
        { target: { value: 'ORD-ENH' } },
      );

      const combobox = screen.getByPlaceholderText('Busque um produto...');
      fireEvent.change(combobox, { target: { value: 'Lavanda' } });
      fireEvent.mouseDown(screen.getByText(/Óleo de Lavanda/));

      await waitFor(() => {
        expect(screen.getByDisplayValue('30')).toBeInTheDocument();
      });

      const valueInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(valueInput, { target: { value: '175' } });
      const personSelect = screen.getByDisplayValue('Selecione uma pessoa');
      fireEvent.change(personSelect, { target: { value: 'p1' } });
      const detailsArea = screen.getByPlaceholderText(
        'Adicione detalhes do item (até 500 caracteres)',
      );
      fireEvent.change(detailsArea, { target: { value: 'Pedido urgente' } });

      const form = screen
        .getByPlaceholderText('Informe o número do pedido da dōTERRA')
        .closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          '/orders',
          expect.objectContaining({
            items: [
              expect.objectContaining({
                productId: 'prod-2',
                chargedValue: 175,
                memberPrice: 180,
                pv: 30,
                details: 'Pedido urgente',
                personId: 'p1',
              }),
            ],
          }),
        );
      });
    });

    it('should send item without product fields when no product selected', async () => {
      mockPost.mockResolvedValue({
        data: { id: '3', orderNumber: 'ORD-STANDALONE' },
      });
      await openModal();

      fireEvent.change(
        screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
        { target: { value: 'ORD-STANDALONE' } },
      );

      const valueInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(valueInput, { target: { value: '50' } });
      const personSelect = screen.getByDisplayValue('Selecione uma pessoa');
      fireEvent.change(personSelect, { target: { value: 'p1' } });

      const form = screen
        .getByPlaceholderText('Informe o número do pedido da dōTERRA')
        .closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          '/orders',
          expect.objectContaining({
            items: [
              expect.objectContaining({
                productId: null,
                memberPrice: null,
                pv: null,
                chargedValue: 50,
                personId: 'p1',
              }),
            ],
          }),
        );
      });
    });

    it('should display details character counter', async () => {
      await openModal();
      const form = screen
        .getByPlaceholderText('Informe o número do pedido da dōTERRA')
        .closest('form');
      const detailsArea = screen.getByPlaceholderText(
        'Adicione detalhes do item (até 500 caracteres)',
      );
      fireEvent.change(detailsArea, { target: { value: 'abc' } });
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('3/500')).toBeInTheDocument();
      });
    });

    it('should allow empty charged value (assumed zero)', async () => {
      mockPost.mockResolvedValue({
        data: { id: '3', orderNumber: 'ORD-EMPTY' },
      });
      await openModal();

      fireEvent.change(
        screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
        { target: { value: 'ORD-EMPTY' } },
      );
      const personSelect = screen.getByDisplayValue('Selecione uma pessoa');
      fireEvent.change(personSelect, { target: { value: 'p1' } });

      const form = screen
        .getByPlaceholderText('Informe o número do pedido da dōTERRA')
        .closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          '/orders',
          expect.objectContaining({
            items: [
              expect.objectContaining({
                chargedValue: 0,
                personId: 'p1',
              }),
            ],
          }),
        );
      });
    });

    it('should reject negative charged value', async () => {
      await openModal();
      fireEvent.change(
        screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
        { target: { value: 'ORD-NEG' } },
      );
      const personSelect = screen.getByDisplayValue('Selecione uma pessoa');
      fireEvent.change(personSelect, { target: { value: 'p1' } });
      const valueInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(valueInput, { target: { value: '-5' } });

      const form = screen
        .getByPlaceholderText('Informe o número do pedido da dōTERRA')
        .closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(
          within(screen.getByTestId('order-item-0')).getByText(
            'Valor não pode ser negativo',
          ),
        ).toBeInTheDocument();
      });
    });

    it('should render the per-item validation error inside the item card (not behind the modal)', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Novo Pedido'));
      await waitFor(() => {
        expect(screen.getByText('Itens do Pedido')).toBeInTheDocument();
      });

      fireEvent.change(
        screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
        { target: { value: 'ORD-NOPERSON' } },
      );
      const form = screen
        .getByPlaceholderText('Informe o número do pedido da dōTERRA')
        .closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(
          within(screen.getByTestId('order-item-0')).getByText(
            'Pessoa é obrigatória',
          ),
        ).toBeInTheDocument();
      });

      const modal = document.querySelector('.fixed.inset-0.z-\\[60\\]');
      expect(modal).not.toBeNull();
      expect(
        within(modal).getByText('Pessoa é obrigatória'),
      ).toBeInTheDocument();
    });

    it('should clear the item error once the item is fixed', async () => {
      await openModal();
      fireEvent.change(
        screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
        { target: { value: 'ORD-FIXED' } },
      );
      const form = screen
        .getByPlaceholderText('Informe o número do pedido da dōTERRA')
        .closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(
          within(screen.getByTestId('order-item-0')).getByText(
            'Pessoa é obrigatória',
          ),
        ).toBeInTheDocument();
      });

      const personSelect = screen.getByDisplayValue('Selecione uma pessoa');
      fireEvent.change(personSelect, { target: { value: 'p1' } });

      expect(
        within(screen.getByTestId('order-item-0')).queryByText(
          'Pessoa é obrigatória',
        ),
      ).not.toBeInTheDocument();
    });

    it('should show backend submit failure as a toast (not the inline banner)', async () => {
      mockPost.mockRejectedValue({
        response: { data: { error: 'Erro ao criar pedido. Tente novamente.' } },
      });
      await openModal();

      fireEvent.change(
        screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
        { target: { value: 'ORD-FAIL' } },
      );
      const personSelect = screen.getByDisplayValue('Selecione uma pessoa');
      fireEvent.change(personSelect, { target: { value: 'p1' } });
      const valueInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(valueInput, { target: { value: '100' } });

      const form = screen
        .getByPlaceholderText('Informe o número do pedido da dōTERRA')
        .closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(
          screen.getByText('Erro ao criar pedido. Tente novamente.'),
        ).toBeInTheDocument();
      });
      expect(
        screen.queryByTestId('order-number-error'),
      ).not.toBeInTheDocument();
    });

    it('should allow zero charged value (free item / gift)', async () => {
      mockPost.mockResolvedValue({
        data: { id: '3', orderNumber: 'ORD-GIFT' },
      });
      await openModal();

      fireEvent.change(
        screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
        { target: { value: 'ORD-GIFT' } },
      );
      const valueInput = screen.getByPlaceholderText('0.00');
      fireEvent.change(valueInput, { target: { value: '0' } });
      const personSelect = screen.getByDisplayValue('Selecione uma pessoa');
      fireEvent.change(personSelect, { target: { value: 'p1' } });

      const form = screen
        .getByPlaceholderText('Informe o número do pedido da dōTERRA')
        .closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          '/orders',
          expect.objectContaining({
            items: [
              expect.objectContaining({
                chargedValue: 0,
                personId: 'p1',
              }),
            ],
          }),
        );
      });
    });
  });

  describe('Edit Order', () => {
    beforeEach(() => {
      mockGetImplementation(mockOrders);
    });

    it('should open edit modal with pre-filled data', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('ORD-001')).toBeInTheDocument();
      });

      await clickOrderAction('1', 'Editar');

      await waitFor(() => {
        expect(screen.getByText('Editar Pedido')).toBeInTheDocument();
        expect(screen.getByDisplayValue('ORD-001')).toBeInTheDocument();
      });
    });

    it('should pre-fill date field with order date in edit modal', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('ORD-001')).toBeInTheDocument();
      });

      await clickOrderAction('1', 'Editar');

      await waitFor(() => {
        expect(screen.getByText('Editar Pedido')).toBeInTheDocument();
        const dateInput = screen.getByLabelText('Data do Pedido');
        expect(dateInput.value).toBe('2026-05-15');
      });
    });

    it('should pre-fill product snapshot fields in edit modal', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('ORD-001')).toBeInTheDocument();
      });

      await clickOrderAction('1', 'Editar');

      await waitFor(() => {
        expect(screen.getByText('Editar Pedido')).toBeInTheDocument();
      });

      expect(
        screen.getByDisplayValue('Adaptiv Pastilhas (60226006)'),
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue('15')).toBeInTheDocument();
    });

    it('should display an INATIVO product name in edit modal even when not in the available list', async () => {
      const inactiveOrder = {
        id: '10',
        orderNumber: 'ORD-INATIVO',
        orderDate: '2026-05-15T00:00:00.000Z',
        totalValue: '100.00',
        status: 'PENDENTE',
        accountOwner: null,
        paymentType: null,
        orderNotes: null,
        items: [
          {
            id: 'i-inactive',
            description: 'Produto Inativo',
            chargedValue: '100.00',
            personId: 'p1',
            person: { name: 'João' },
            productId: 'prod-inativo',
            product: {
              id: 'prod-inativo',
              name: 'Produto Inativo',
              code: '999999',
            },
            memberPrice: '50.00',
            pv: '5',
          },
        ],
      };

      mockGet.mockImplementation((url) => {
        if (url === '/orders')
          return Promise.resolve({ data: [inactiveOrder] });
        if (url === '/people') return Promise.resolve({ data: mockPeople });
        if (url.startsWith('/products'))
          return Promise.resolve({ data: { data: mockProducts } });
        return Promise.resolve({ data: [] });
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('ORD-INATIVO')).toBeInTheDocument();
      });

      await clickOrderAction('10', 'Editar');

      await waitFor(() => {
        expect(screen.getByText('Editar Pedido')).toBeInTheDocument();
      });

      expect(
        screen.getByDisplayValue('Produto Inativo (999999)'),
      ).toBeInTheDocument();
      expect(screen.getByText('Limpar produto')).toBeInTheDocument();
    });

    it('should pre-fill descriptive fields in edit modal', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('ORD-001')).toBeInTheDocument();
      });

      await clickOrderAction('1', 'Editar');

      await waitFor(() => {
        expect(screen.getByText('Editar Pedido')).toBeInTheDocument();
      });

      expect(
        screen.getByLabelText('Responsável pela conta (ID dōTERRA ou nome)')
          .value,
      ).toBe('6254862 - Ana Silva');
      expect(screen.getByLabelText('Tipo de Pagamento').value).toBe('PIX');
      expect(screen.getByLabelText('Descrição do Pedido').value).toBe(
        'Pedido de promoção de março',
      );
    });

    it('should send descriptive fields when updating an order', async () => {
      mockPut.mockResolvedValue({ data: { id: '1', orderNumber: 'ORD-001' } });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('ORD-001')).toBeInTheDocument();
      });

      await clickOrderAction('1', 'Editar');

      await waitFor(() => {
        expect(screen.getByText('Editar Pedido')).toBeInTheDocument();
      });

      fireEvent.change(
        screen.getByLabelText('Responsável pela conta (ID dōTERRA ou nome)'),
        { target: { value: 'João Pereira' } },
      );
      fireEvent.change(screen.getByLabelText('Tipo de Pagamento'), {
        target: { value: 'BOLETO' },
      });
      fireEvent.change(screen.getByLabelText('Descrição do Pedido'), {
        target: { value: 'Encomenda' },
      });

      const form = screen.getByDisplayValue('ORD-001').closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith(
          '/orders/1',
          expect.objectContaining({
            accountOwner: 'João Pereira',
            paymentType: 'BOLETO',
            orderNotes: 'Encomenda',
          }),
        );
      });
    });

    it('should send chargedValue, pv and details when updating an order', async () => {
      mockPut.mockResolvedValue({ data: { id: '1', orderNumber: 'ORD-001' } });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('ORD-001')).toBeInTheDocument();
      });

      await clickOrderAction('1', 'Editar');

      await waitFor(() => {
        expect(screen.getByText('Editar Pedido')).toBeInTheDocument();
      });

      const valueInputs = screen.getAllByPlaceholderText('0.00');
      fireEvent.change(valueInputs[0], { target: { value: '95' } });

      const form = screen.getByDisplayValue('ORD-001').closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith(
          '/orders/1',
          expect.objectContaining({
            items: [
              expect.objectContaining({
                productId: 'prod-1',
                chargedValue: 95,
                memberPrice: 90,
                pv: 15,
              }),
              expect.objectContaining({
                productId: 'prod-2',
                chargedValue: 200,
                memberPrice: 180,
                pv: 30,
              }),
            ],
          }),
        );
      });
    });
  });

  describe('Delete Order', () => {
    beforeEach(() => {
      mockGetImplementation(mockOrders);
    });

    it('should call delete API when confirming deletion', async () => {
      mockDelete.mockResolvedValue({
        data: { message: 'Order deleted successfully' },
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('ORD-001')).toBeInTheDocument();
      });

      await clickOrderAction('1', 'Excluir');

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));

      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalledWith('/orders/1');
      });
    });

    it('should not delete when user cancels', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('ORD-001')).toBeInTheDocument();
      });

      await clickOrderAction('1', 'Excluir');

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(mockDelete).not.toHaveBeenCalled();
    });
  });

  describe('Self person selection in order form', () => {
    const SELF_PERSON_ID = '__SELF__';

    const openCreateModal = async () => {
      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Novo Pedido'));
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
        ).toBeInTheDocument();
      });
    };

    it('should show an "Eu (você)" option in the person select when no self person exists', async () => {
      mockGetImplementation([], mockPeople);
      renderPage();

      await openCreateModal();

      const personSelect = screen.getByDisplayValue('Selecione uma pessoa');
      const options = within(personSelect).getAllByRole('option');
      const labels = options.map((o) => o.textContent);
      expect(labels).toContain('Eu (você)');
    });

    it('should auto-create the self person and bind it to the item when "Eu (você)" is selected', async () => {
      mockGetImplementation([], mockPeople);
      mockPost.mockImplementation((url) => {
        if (url === '/people/self') {
          return Promise.resolve({
            data: { id: 'p-self', name: 'testuser', isSelf: true },
          });
        }
        if (url === '/orders') {
          return Promise.resolve({ data: { id: '3', orderNumber: 'ORD-003' } });
        }
        return Promise.resolve({ data: {} });
      });
      renderPage();

      await openCreateModal();

      const personSelect = screen.getByDisplayValue('Selecione uma pessoa');
      fireEvent.change(personSelect, { target: { value: SELF_PERSON_ID } });

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/people/self');
      });

      fireEvent.change(
        screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
        { target: { value: 'ORD-SELF' } },
      );
      fireEvent.change(screen.getByPlaceholderText('0.00'), {
        target: { value: '150' },
      });

      const form = screen
        .getByPlaceholderText('Informe o número do pedido da dōTERRA')
        .closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          '/orders',
          expect.objectContaining({
            items: expect.arrayContaining([
              expect.objectContaining({ personId: 'p-self' }),
            ]),
          }),
        );
      });
    });

    it('should show the self person with "(Você)" and bind it directly without auto-creating', async () => {
      const selfPerson = { id: 'p-self', name: 'João Silva', isSelf: true };
      mockGetImplementation([], [selfPerson, ...mockPeople]);
      renderPage();

      await openCreateModal();

      const personSelect = screen.getByDisplayValue('Selecione uma pessoa');
      const options = within(personSelect).getAllByRole('option');
      const labels = options.map((o) => o.textContent);
      expect(labels).toContain('João Silva (Você)');

      fireEvent.change(personSelect, { target: { value: 'p-self' } });
      expect(mockPost).not.toHaveBeenCalled();

      fireEvent.change(
        screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
        { target: { value: 'ORD-SELF2' } },
      );
      fireEvent.change(screen.getByPlaceholderText('0.00'), {
        target: { value: '100' },
      });

      const form = screen
        .getByPlaceholderText('Informe o número do pedido da dōTERRA')
        .closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          '/orders',
          expect.objectContaining({
            items: expect.arrayContaining([
              expect.objectContaining({ personId: 'p-self' }),
            ]),
          }),
        );
      });
    });
  });

  describe('Order item quantity, stock toggle and price mode', () => {
    const openCreateModal = async () => {
      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Novo Pedido'));
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
        ).toBeInTheDocument();
      });
    };

    it('should render the quantity field with default 1', async () => {
      mockGetImplementation([], mockPeople);
      renderPage();
      await openCreateModal();
      expect(screen.getByTestId('order-item-quantity-0').value).toBe('1');
    });

    it('should validate quantity less than 1', async () => {
      mockGetImplementation([], mockPeople);
      renderPage();
      await openCreateModal();
      fireEvent.change(screen.getByTestId('order-item-quantity-0'), {
        target: { value: '0' },
      });
      fireEvent.change(
        screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
        { target: { value: 'ORD-Q' } },
      );
      const form = screen
        .getByPlaceholderText('Informe o número do pedido da dōTERRA')
        .closest('form');
      fireEvent.submit(form);
      await waitFor(() => {
        expect(screen.getByText(/Quantidade deve ser/)).toBeInTheDocument();
      });
    });

    it('should only show the stock toggle when the item person is self', async () => {
      const selfPerson = { id: 'p-self', name: 'Eu', isSelf: true };
      mockGetImplementation([], [selfPerson, ...mockPeople]);
      mockPost.mockResolvedValue({ data: { id: '1', orderNumber: 'ORD-S' } });
      renderPage();
      await openCreateModal();

      const personSelect = screen.getByDisplayValue('Selecione uma pessoa');

      // No person selected yet -> no toggle
      expect(
        screen.queryByTestId('order-item-stock-toggle-0'),
      ).not.toBeInTheDocument();

      // Switch to a non-self person -> still no toggle
      fireEvent.change(personSelect, { target: { value: 'p1' } });
      expect(
        screen.queryByTestId('order-item-stock-toggle-0'),
      ).not.toBeInTheDocument();

      // Switch back to self -> toggle appears
      fireEvent.change(personSelect, { target: { value: 'p-self' } });
      expect(
        screen.getByTestId('order-item-stock-toggle-0'),
      ).toBeInTheDocument();
    });

    it('should reset forStock when switching from self to a non-self person', async () => {
      const selfPerson = { id: 'p-self', name: 'Eu', isSelf: true };
      mockGetImplementation([], [selfPerson, ...mockPeople]);
      mockPost.mockResolvedValue({ data: { id: '1', orderNumber: 'ORD-R' } });
      renderPage();
      await openCreateModal();

      fireEvent.change(screen.getByDisplayValue('Selecione uma pessoa'), {
        target: { value: 'p-self' },
      });
      const toggle = screen.getByTestId('order-item-stock-toggle-0');
      fireEvent.click(toggle);
      expect(toggle.checked).toBe(true);

      fireEvent.change(screen.getByDisplayValue(/Eu \(Você\)/), {
        target: { value: 'p1' },
      });
      expect(
        screen.queryByTestId('order-item-stock-toggle-0'),
      ).not.toBeInTheDocument();

      const form = screen
        .getByPlaceholderText('Informe o número do pedido da dōTERRA')
        .closest('form');
      fireEvent.change(
        screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
        { target: { value: 'ORD-RS' } },
      );
      fireEvent.submit(form);
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          '/orders',
          expect.objectContaining({
            items: expect.arrayContaining([
              expect.objectContaining({ personId: 'p1', forStock: false }),
            ]),
          }),
        );
      });
    });

    it('should send quantity, forStock and chargedValueMode in the create payload', async () => {
      const selfPerson = { id: 'p-self', name: 'Eu', isSelf: true };
      mockGetImplementation([], [selfPerson, ...mockPeople]);
      mockPost.mockResolvedValue({ data: { id: '1', orderNumber: 'ORD-P' } });
      renderPage();
      await openCreateModal();

      fireEvent.change(screen.getByDisplayValue('Selecione uma pessoa'), {
        target: { value: 'p-self' },
      });
      fireEvent.change(screen.getByTestId('order-item-quantity-0'), {
        target: { value: '3' },
      });
      fireEvent.click(screen.getByTestId('order-item-stock-toggle-0'));
      fireEvent.change(
        screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
        { target: { value: 'ORD-PAY' } },
      );
      fireEvent.change(screen.getByPlaceholderText('0.00'), {
        target: { value: '50' },
      });

      const form = screen
        .getByPlaceholderText('Informe o número do pedido da dōTERRA')
        .closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          '/orders',
          expect.objectContaining({
            items: expect.arrayContaining([
              expect.objectContaining({
                personId: 'p-self',
                quantity: 3,
                forStock: true,
                chargedValueMode: 'UNIT',
              }),
            ]),
          }),
        );
      });
    });

    it('NOT should call /stock/movements from the frontend when creating an order', async () => {
      const selfPerson = { id: 'p-self', name: 'Eu', isSelf: true };
      mockGetImplementation([], [selfPerson, ...mockPeople]);
      mockPost.mockResolvedValue({ data: { id: '1', orderNumber: 'O' } });
      renderPage();
      await openCreateModal();

      fireEvent.change(screen.getByDisplayValue('Selecione uma pessoa'), {
        target: { value: 'p-self' },
      });
      fireEvent.click(screen.getByTestId('order-item-stock-toggle-0'));
      fireEvent.change(
        screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
        { target: { value: 'ORD-NO' } },
      );

      const form = screen
        .getByPlaceholderText('Informe o número do pedido da dōTERRA')
        .closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/orders', expect.anything());
      });
      expect(mockPost).not.toHaveBeenCalledWith(
        '/stock/movements',
        expect.anything(),
      );
    });

    it('should compute Soma dos Produtos reflecting UNIT mode (chargedValue * quantity)', async () => {
      mockGetImplementation([], mockPeople);
      renderPage();
      await openCreateModal();
      fireEvent.change(screen.getByTestId('order-item-quantity-0'), {
        target: { value: '3' },
      });
      fireEvent.change(screen.getByPlaceholderText('0.00'), {
        target: { value: '10.5' },
      });
      expect(screen.getByTestId('order-totals-charged').textContent).toMatch(
        /31,50/,
      );
    });

    it('should compute Soma dos Produtos reflecting TOTAL mode (just chargedValue)', async () => {
      mockGetImplementation([], mockPeople);
      renderPage();
      await openCreateModal();
      fireEvent.change(screen.getByTestId('order-item-quantity-0'), {
        target: { value: '3' },
      });
      fireEvent.change(screen.getByPlaceholderText('0.00'), {
        target: { value: '40' },
      });
      fireEvent.change(screen.getByTestId('order-item-price-mode-0'), {
        target: { value: 'TOTAL' },
      });
      expect(screen.getByTestId('order-totals-charged').textContent).toMatch(
        /40,00/,
      );
    });

    it('should display Valor Membro (total) as memberPrice * quantity', async () => {
      mockGetImplementation([], mockPeople);
      renderPage();
      await openCreateModal();
      fireEvent.change(screen.getByPlaceholderText('Busque um produto...'), {
        target: { value: 'Lavanda' },
      });
      await waitFor(() => {
        expect(screen.getByText(/Óleo de Lavanda/)).toBeInTheDocument();
      });
      fireEvent.mouseDown(screen.getByText(/Óleo de Lavanda/));
      await waitFor(() => {
        expect(
          screen.getAllByDisplayValue(/R\$\s*180,00/).length,
        ).toBeGreaterThanOrEqual(1);
      });
      fireEvent.change(screen.getByTestId('order-item-quantity-0'), {
        target: { value: '3' },
      });
      // memberPrice 180 * quantity 3 = 540
      expect(
        screen.getAllByDisplayValue(/R\$\s*540,00/).length,
      ).toBeGreaterThanOrEqual(1);
    });

    it('should prefill quantity, forStock and chargedValueMode when editing an order', async () => {
      const selfPerson = { id: 'p-self', name: 'Eu', isSelf: true };
      const orderWithStock = [
        {
          id: '10',
          orderNumber: 'ORD-EDIT',
          orderDate: '2026-05-15T00:00:00.000Z',
          totalValue: '200.00',
          status: 'QUITADO',
          accountOwner: null,
          paymentType: null,
          orderNotes: null,
          items: [
            {
              id: 'it-1',
              description: 'Estoque',
              chargedValue: '40',
              personId: 'p-self',
              person: selfPerson,
              productId: 'prod-2',
              product: mockProducts[1],
              memberPrice: '180',
              pv: '30',
              details: null,
              quantity: 5,
              forStock: true,
              chargedValueMode: 'TOTAL',
            },
          ],
        },
      ];
      mockGetImplementation(orderWithStock, [selfPerson, ...mockPeople]);
      renderPage();

      await clickOrderAction('10', 'Editar');
      await waitFor(() => {
        expect(screen.getByTestId('order-item-quantity-0')).toBeInTheDocument();
      });
      expect(screen.getByTestId('order-item-quantity-0').value).toBe('5');
      expect(screen.getByTestId('order-item-stock-toggle-0').checked).toBe(
        true,
      );
      expect(screen.getByTestId('order-item-price-mode-0').value).toBe('TOTAL');
    });
  });

  describe('Search, filters and sorting (server-side)', () => {
    it('should fetch orders with the committed search term when submitting', async () => {
      mockGetImplementation(mockOrders);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('ORD-001')).toBeInTheDocument();
      });
      const initialCalls = mockGet.mock.calls.filter(
        ([url]) => url === '/orders',
      );

      fireEvent.change(screen.getByLabelText('Buscar pedidos'), {
        target: { value: 'ORD-002' },
      });
      fireEvent.submit(screen.getByLabelText('Filtros de pedidos'));

      await waitFor(() => {
        const orderCalls = mockGet.mock.calls.filter(
          ([url]) => url === '/orders',
        );
        expect(orderCalls.length).toBeGreaterThan(initialCalls.length);
      });
      const lastOrderCall = mockGet.mock.calls[mockGet.mock.calls.length - 1];
      expect(lastOrderCall[0]).toBe('/orders');
      expect(lastOrderCall[1].params.q).toBe('ORD-002');
      expect(lastOrderCall[1].params.searchField).toBeUndefined();
    });

    it('should include the selected search column in the request', async () => {
      mockGetImplementation(mockOrders);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('ORD-001')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Coluna de busca'), {
        target: { value: 'orderNumber' },
      });

      await waitFor(() => {
        const lastOrderCall = mockGet.mock.calls
          .filter(([url]) => url === '/orders')
          .at(-1);
        expect(lastOrderCall[1].params.searchField).toBe('orderNumber');
      });
    });

    it('should refetch immediately when the status filter changes', async () => {
      mockGetImplementation(mockOrders);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('ORD-001')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Status'), {
        target: { value: 'QUITADO' },
      });

      await waitFor(() => {
        const lastOrderCall = mockGet.mock.calls
          .filter(([url]) => url === '/orders')
          .at(-1);
        expect(lastOrderCall[1].params.status).toBe('QUITADO');
      });
    });

    it('should refetch immediately when the payment type filter changes', async () => {
      mockGetImplementation(mockOrders);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('ORD-001')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Tipo de pagamento'), {
        target: { value: 'PIX' },
      });

      await waitFor(() => {
        const lastOrderCall = mockGet.mock.calls
          .filter(([url]) => url === '/orders')
          .at(-1);
        expect(lastOrderCall[1].params.paymentType).toBe('PIX');
      });
    });

    it('should combine an active filter with a sort in a single request', async () => {
      mockGetImplementation(mockOrders);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('ORD-001')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Status'), {
        target: { value: 'QUITADO' },
      });
      await waitFor(() => {
        const calls = mockGet.mock.calls.filter(([url]) => url === '/orders');
        expect(calls.at(-1)[1].params.status).toBe('QUITADO');
      });

      fireEvent.click(screen.getByTestId('orders-sort-totalValue'));

      await waitFor(() => {
        const calls = mockGet.mock.calls.filter(([url]) => url === '/orders');
        const last = calls.at(-1);
        expect(last[1].params.status).toBe('QUITADO');
        expect(last[1].params.sortBy).toBe('totalValue');
        expect(last[1].params.sortDir).toBe('asc');
      });
    });

    it('should toggle the sort direction when clicking an active header twice', async () => {
      mockGetImplementation(mockOrders);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('ORD-001')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('orders-sort-totalValue'));
      await waitFor(() => {
        const last = mockGet.mock.calls
          .filter(([url]) => url === '/orders')
          .at(-1);
        expect(last[1].params.sortBy).toBe('totalValue');
        expect(last[1].params.sortDir).toBe('asc');
      });

      fireEvent.click(screen.getByTestId('orders-sort-totalValue'));
      await waitFor(() => {
        const last = mockGet.mock.calls
          .filter(([url]) => url === '/orders')
          .at(-1);
        expect(last[1].params.sortBy).toBe('totalValue');
        expect(last[1].params.sortDir).toBe('desc');
      });
    });

    it('should show the filtered empty state when no order matches', async () => {
      mockGetImplementation([]);
      renderPage();

      await waitFor(() => {
        expect(
          screen.getByText('Nenhum pedido cadastrado'),
        ).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Buscar pedidos'), {
        target: { value: 'NãoExiste' },
      });
      fireEvent.submit(screen.getByLabelText('Filtros de pedidos'));

      await waitFor(() => {
        expect(
          screen.getByText(
            'Nenhum pedido encontrado para os filtros aplicados.',
          ),
        ).toBeInTheDocument();
      });
    });
  });
});
