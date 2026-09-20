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
const mockDelete = vi.fn();

vi.mock('../src/services/api', () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    put: (...args) => mockPut(...args),
    delete: (...args) => mockDelete(...args),
  },
}));

const mockSales = [
  {
    id: '1',
    orderNumber: 'V-0001',
    orderDate: '2026-05-15T00:00:00.000Z',
    totalValue: '300.00',
    shippingValue: '0',
    additionalValue: '0',
    deliveredAt: null,
    status: 'PENDENTE',
    orderNotes: 'Venda de teste',
    items: [
      {
        id: 'i1',
        description: 'Adaptiv Pastilhas',
        chargedValue: '100.00',
        quantity: 1,
        chargedValueMode: 'UNIT',
        personId: 'p1',
        person: { name: 'João Silva' },
        productId: 'prod-1',
        product: { id: 'prod-1', name: 'Adaptiv Pastilhas', code: '60226006' },
        memberPrice: '90.00',
      },
      {
        id: 'i2',
        description: 'Óleo de Lavanda',
        chargedValue: '200.00',
        quantity: 1,
        chargedValueMode: 'UNIT',
        personId: 'p1',
        person: { name: 'João Silva' },
        productId: 'prod-2',
        product: { id: 'prod-2', name: 'Óleo de Lavanda', code: '60226007' },
        memberPrice: '180.00',
        useCashback: true,
      },
    ],
    payments: [],
  },
  {
    id: '2',
    orderNumber: 'V-0002',
    orderDate: '2026-06-20T00:00:00.000Z',
    totalValue: '500.00',
    shippingValue: '10.00',
    additionalValue: '5.00',
    additionalExpenseCategoryId: 'cat-frete',
    additionalExpenseDescription: 'Frete da venda',
    deliveredAt: '2026-06-25T00:00:00.000Z',
    status: 'QUITADO',
    orderNotes: null,
    items: [
      {
        id: 'i3',
        description: 'Menta Verde',
        chargedValue: '485.00',
        quantity: 1,
        chargedValueMode: 'UNIT',
        personId: 'p2',
        person: { name: 'Maria Santos' },
        productId: 'prod-3',
        product: { id: 'prod-3', name: 'Menta Verde', code: '60226008' },
        memberPrice: '50.00',
      },
    ],
    payments: [{ amount: '500.00' }],
  },
  {
    id: '3',
    orderNumber: 'V-0003',
    orderDate: '2026-07-01T00:00:00.000Z',
    totalValue: '500.00',
    shippingValue: '0',
    additionalValue: '0',
    deliveredAt: null,
    status: 'QUITADO',
    orderNotes: 'Venda com excedente',
    items: [
      {
        id: 'i4',
        description: 'Menta Verde',
        chargedValue: '485.00',
        quantity: 1,
        chargedValueMode: 'UNIT',
        personId: 'p2',
        person: { name: 'Maria Santos' },
        productId: 'prod-3',
        product: { id: 'prod-3', name: 'Menta Verde', code: '60226008' },
        memberPrice: '50.00',
      },
    ],
    payments: [{ amount: '600.00' }],
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
  {
    id: 'prod-kit',
    name: 'Kit Bem-Estar',
    code: '60226099',
    memberPrice: '200.00',
    pv: '40',
    status: 'ATIVO',
    productType: 'KIT',
  },
];

const kitSale = {
  id: 'sale-kit',
  orderNumber: 'V-KIT1',
  orderDate: '2026-08-01',
  totalValue: '200.00',
  shippingValue: '0',
  additionalValue: '0',
  deliveredAt: null,
  status: 'PENDENTE',
  orderNotes: null,
  items: [
    {
      id: 'kit-item-1',
      description: 'Kit Bem-Estar',
      chargedValue: '200.00',
      quantity: 1,
      chargedValueMode: 'UNIT',
      personId: 'p1',
      person: { name: 'João Silva' },
      productId: 'prod-kit',
      product: { id: 'prod-kit', name: 'Kit Bem-Estar', code: '60226099' },
      memberPrice: '200.00',
      kitStockMode: 'COMPONENTS',
    },
  ],
  payments: [],
};

const mockExpenseCategories = [
  { id: 'cat-frete', name: 'Frete', type: 'DESPESA', active: true },
  { id: 'cat-marketing', name: 'Marketing', type: 'DESPESA', active: true },
  { id: 'cat-eventos', name: 'Eventos', type: 'DESPESA', active: false },
  { id: 'cat-vendas', name: 'Vendas', type: 'RECEITA', active: true },
];

const mockGetImplementation = (salesData = [], peopleData = mockPeople) => {
  mockGet.mockImplementation((url) => {
    if (url === '/sales') return Promise.resolve({ data: salesData });
    if (url === '/people') return Promise.resolve({ data: peopleData });
    if (url.startsWith('/products'))
      return Promise.resolve({ data: { data: mockProducts } });
    if (url === '/finances/categories')
      return Promise.resolve({ data: mockExpenseCategories });
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

const clickSaleAction = async (saleId, label) => {
  await openSaleActionsMenu(saleId);
  fireEvent.click(screen.getByTestId(`sale-actions-${saleId}-item-${label}`));
};

const openCreateModal = async () => {
  await waitFor(() => {
    expect(screen.getByText('Nova Venda')).toBeInTheDocument();
  });
  fireEvent.click(screen.getByText('Nova Venda'));
  await waitFor(() => {
    expect(screen.getByText('Itens da Venda')).toBeInTheDocument();
  });
};

const todayDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

describe('SalesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the page title "Gestão de Vendas"', async () => {
      mockGetImplementation([]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Gestão de Vendas')).toBeInTheDocument();
      });
    });

    it('should render "Nova Venda" button', async () => {
      mockGetImplementation([]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Nova Venda')).toBeInTheDocument();
      });
    });

    it('should show empty state when no sales exist', async () => {
      mockGetImplementation([]);
      renderPage();
      await waitFor(() => {
        expect(
          screen.getByText('Nenhuma venda cadastrada'),
        ).toBeInTheDocument();
      });
    });

    it('should show loading state', () => {
      mockGet.mockImplementation(() => new Promise(() => {}));
      renderPage();
      expect(screen.getByText('Carregando...')).toBeInTheDocument();
    });
  });

  describe('Sales List', () => {
    beforeEach(() => {
      mockGetImplementation(mockSales);
    });

    it('should not render the "Nº Venda" column', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });
      expect(screen.queryByText('Nº Venda')).not.toBeInTheDocument();
      expect(screen.queryByText('V-0001')).not.toBeInTheDocument();
      expect(screen.queryByText('V-0002')).not.toBeInTheDocument();
    });

    it('should display sale total values', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByText(/R\$\s*300,00/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/R\$\s*500,00/).length).toBeGreaterThan(0);
      });
    });

    it('should display the received amount with the due color', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
        expect(screen.getAllByText('Maria Santos')).toHaveLength(2);
      });
      const findRowByClient = (name) => {
        const rows = screen.getAllByText(name).map((el) => el.closest('tr'));
        return rows.find(
          (row) => row.querySelector('td[data-label="Recebido"]') !== null,
        );
      };
      const getReceivedCell = (row) =>
        row.querySelector('td[data-label="Recebido"]');

      const underpaidCell = getReceivedCell(findRowByClient('João Silva'));
      expect(underpaidCell).toHaveTextContent(/R\$\s*0,00/);
      expect(underpaidCell.className).toContain('text-danger-fg');

      const settledCell = getReceivedCell(findRowByClient('Maria Santos'));
      expect(settledCell).toHaveTextContent(/R\$\s*500,00/);
      expect(settledCell.className).toContain('text-success-fg');
      expect(settledCell.className).not.toContain('text-danger-fg');

      const overpaidRow = screen
        .getAllByText('Venda com excedente')
        .map((el) => el.closest('tr'))
        .find((row) => row.querySelector('td[data-label="Recebido"]') !== null);
      const overpaidCell = overpaidRow.querySelector(
        'td[data-label="Recebido"]',
      );
      expect(overpaidCell).toHaveTextContent(/R\$\s*600,00/);
      expect(overpaidCell.className).toContain('text-info-fg');
    });

    it('should display status badges', async () => {
      renderPage();
      await waitFor(() => {
        const joaoRow = screen.getByText('João Silva').closest('tr');
        expect(within(joaoRow).getByText('Pendente')).toBeInTheDocument();
        const mariaRow = screen.getAllByText('Maria Santos')[0].closest('tr');
        expect(within(mariaRow).getByText('Quitado')).toBeInTheDocument();
      });
    });

    it('should render column headers in Title Case without all-caps styling', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      [
        'Data',
        'Cliente',
        'Valor (R$)',
        'Pendente',
        'Recebido',
        'Entrega',
        'Descrição',
        'Status',
        'Ações',
      ].forEach((name) => {
        const header = screen.getByRole('columnheader', { name });
        expect(header.className).not.toMatch(/\buppercase\b/);
      });
    });

    it('should display the client name per sale', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
        expect(screen.getAllByText('Maria Santos')).toHaveLength(2);
      });
    });

    it('should show "Pendente de entrega" badge for undelivered sales', async () => {
      renderPage();
      await waitFor(() => {
        expect(
          screen.getAllByText('Pendente de entrega').length,
        ).toBeGreaterThan(0);
      });
    });

    it('should show "Entregue" badge with the delivery date for delivered sales', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Entregue')).toBeInTheDocument();
        expect(screen.getByText('25/06/2026')).toBeInTheDocument();
      });
    });

    it('should display sale notes in description column', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Venda de teste')).toBeInTheDocument();
      });
    });

    it('should truncate the description to a single line with the full text on hover', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Venda de teste')).toBeInTheDocument();
      });
      const descriptionCell = screen
        .getByText('Venda de teste')
        .closest('td[data-label="Descrição"]');
      const span = within(descriptionCell).getByText('Venda de teste');
      expect(span).toHaveAttribute('title', 'Venda de teste');
      expect(span.className).toContain('truncate');
      expect(span.className).not.toContain('line-clamp-2');
    });

    it('should show the items charged values on the client cell tooltip', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });
      const joaoCell = screen
        .getByText('João Silva')
        .closest('td[data-label="Cliente"]');
      expect(joaoCell).toHaveAttribute(
        'title',
        'Adaptiv Pastilhas (Cobrei R$\u00a0100,00) / Óleo de Lavanda (Cobrei R$\u00a0200,00)',
      );

      const mariaCell = screen
        .getAllByText('Maria Santos')[0]
        .closest('td[data-label="Cliente"]');
      expect(mariaCell).toHaveAttribute(
        'title',
        'Menta Verde (Cobrei R$\u00a0485,00)',
      );
    });

    it('should not offer "Número da venda" in the search field options', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByLabelText('Coluna de busca')).toBeInTheDocument();
      });
      const select = screen.getByLabelText('Coluna de busca');
      const labels = within(select)
        .getAllByRole('option')
        .map((o) => o.textContent);
      expect(labels).not.toContain('Número da venda');
      expect(labels).toContain('Todas as colunas');
      expect(labels).toContain('Cliente');
      expect(labels).toContain('Descrição');
    });

    it('should render an actions kebab trigger per sale', async () => {
      renderPage();
      await waitFor(() => {
        const triggers = screen.getAllByTestId(/^sale-actions-\d+-trigger$/);
        expect(triggers).toHaveLength(3);
      });
    });

    it('should show "Registrar Pagamento" and "Detalhar Pagamentos" in the menu', async () => {
      renderPage();
      await openSaleActionsMenu('1');
      expect(
        screen.getByTestId('sale-actions-1-item-Registrar-Pagamento'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('sale-actions-1-item-Detalhar-Pagamentos'),
      ).toBeInTheDocument();
    });

    it('should show "Marcar como entregue" for undelivered sales', async () => {
      renderPage();
      await openSaleActionsMenu('1');
      expect(
        screen.getByTestId('sale-actions-1-item-Marcar-como-entregue'),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId('sale-actions-1-item-Desmarcar-entrega'),
      ).not.toBeInTheDocument();
    });

    it('should show "Desmarcar entrega" for delivered sales', async () => {
      renderPage();
      await openSaleActionsMenu('2');
      expect(
        screen.getByTestId('sale-actions-2-item-Desmarcar-entrega'),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId('sale-actions-2-item-Marcar-como-entregue'),
      ).not.toBeInTheDocument();
    });

    it('should include "Editar" and "Excluir" items', async () => {
      renderPage();
      await openSaleActionsMenu('1');
      expect(
        screen.getByTestId('sale-actions-1-item-Editar'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('sale-actions-1-item-Excluir'),
      ).toBeInTheDocument();
    });
  });

  describe('Create Sale Modal', () => {
    beforeEach(() => {
      mockGetImplementation([]);
    });

    it('should open the create modal when clicking "Nova Venda"', async () => {
      renderPage();
      await openCreateModal();
      expect(screen.getByText('Itens da Venda')).toBeInTheDocument();
    });

    it('should display the client select in the create modal', async () => {
      renderPage();
      await openCreateModal();
      expect(screen.getByLabelText('Cliente')).toBeInTheDocument();
      expect(
        screen.getByDisplayValue('Selecione um cliente'),
      ).toBeInTheDocument();
    });

    it('should only list non-self people as clients', async () => {
      const selfPerson = { id: 'p-self', name: 'Eu Mesmo', isSelf: true };
      mockGetImplementation([], [selfPerson, ...mockPeople]);
      renderPage();
      await openCreateModal();
      const select = screen.getByLabelText('Cliente');
      const labels = within(select)
        .getAllByRole('option')
        .map((o) => o.textContent);
      expect(labels).not.toContain('Eu Mesmo');
      expect(labels).toContain('João Silva');
      expect(labels).toContain('Maria Santos');
    });

    it('should display "Data do Pedido" defaulting to today', async () => {
      renderPage();
      await openCreateModal();
      const dateInput = screen.getByLabelText('Data do Pedido');
      expect(dateInput.value).toBe(todayDate());
    });

    it('should display Frete, Valores Adicionais, Descrição and Data de entrega fields', async () => {
      renderPage();
      await openCreateModal();
      expect(screen.getByTestId('sale-freight')).toBeInTheDocument();
      expect(screen.getByTestId('sale-additional')).toBeInTheDocument();
      expect(screen.getByLabelText('Descrição da Venda')).toBeInTheDocument();
      expect(screen.getByLabelText('Data de entrega')).toBeInTheDocument();
    });

    it('should display the sale description character counter up to 2000', async () => {
      renderPage();
      await openCreateModal();
      expect(screen.getByText('0/2000')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Descrição da Venda'), {
        target: { value: 'Promoção' },
      });

      expect(screen.getByText('8/2000')).toBeInTheDocument();
    });

    it('should NOT display purchase-only fields', async () => {
      renderPage();
      await openCreateModal();
      expect(
        screen.queryByPlaceholderText('Informe o número do pedido da dōTERRA'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText('Tipo de Pagamento'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText('Conta ID (ID dōTERRA ou nome)'),
      ).not.toBeInTheDocument();
      expect(screen.queryByLabelText('PV doTERRA')).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText('Valor doTERRA (R$)'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('order-attachment-input'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('order-is-team-order'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('Este item é para meu estoque'),
      ).not.toBeInTheDocument();
    });

    it('should show validation error when submitting without a client', async () => {
      renderPage();
      await openCreateModal();
      fireEvent.change(screen.getByPlaceholderText('0,00'), {
        target: { value: '10000' },
      });
      const form = screen.getByTestId('sale-freight').closest('form');
      fireEvent.submit(form);
      await waitFor(() => {
        expect(screen.getByTestId('sale-client-error')).toHaveTextContent(
          'Cliente é obrigatório',
        );
      });
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('should show validation error when an item has no product', async () => {
      renderPage();
      await openCreateModal();
      fireEvent.change(screen.getByLabelText('Cliente'), {
        target: { value: 'p1' },
      });
      fireEvent.change(screen.getByPlaceholderText('0,00'), {
        target: { value: '10000' },
      });
      const form = screen.getByTestId('sale-freight').closest('form');
      fireEvent.submit(form);
      await waitFor(() => {
        expect(
          within(screen.getByTestId('sale-item-0')).getByText(
            'Produto é obrigatório',
          ),
        ).toBeInTheDocument();
      });
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('should strip the minus sign from the freight field instead of allowing negative values', async () => {
      renderPage();
      await openCreateModal();
      fireEvent.change(screen.getByLabelText('Cliente'), {
        target: { value: 'p1' },
      });
      fireEvent.change(screen.getByTestId('sale-freight'), {
        target: { value: '-5' },
      });
      fireEvent.change(screen.getByPlaceholderText('0,00'), {
        target: { value: '10000' },
      });
      await waitFor(() => {
        expect(screen.getByTestId('sale-freight')).toHaveValue('0,05');
      });
      expect(
        screen.queryByTestId('sale-freight-error'),
      ).not.toBeInTheDocument();
    });

    it('should strip the minus sign from the additional value field instead of allowing negative values', async () => {
      renderPage();
      await openCreateModal();
      fireEvent.change(screen.getByLabelText('Cliente'), {
        target: { value: 'p1' },
      });
      fireEvent.change(screen.getByTestId('sale-additional'), {
        target: { value: '-1' },
      });
      fireEvent.change(screen.getByPlaceholderText('0,00'), {
        target: { value: '10000' },
      });
      await waitFor(() => {
        expect(screen.getByTestId('sale-additional')).toHaveValue('0,01');
      });
      expect(
        screen.queryByTestId('sale-additional-error'),
      ).not.toBeInTheDocument();
    });

    it('should send the full create payload', async () => {
      mockPost.mockResolvedValue({
        data: { id: '3', orderNumber: 'V-0003' },
      });
      renderPage();
      await openCreateModal();

      fireEvent.change(screen.getByLabelText('Cliente'), {
        target: { value: 'p1' },
      });
      fireEvent.change(screen.getByLabelText('Data do Pedido'), {
        target: { value: '2026-03-10' },
      });
      fireEvent.change(screen.getByTestId('sale-freight'), {
        target: { value: '2550' },
      });
      fireEvent.change(screen.getByTestId('sale-additional'), {
        target: { value: '1000' },
      });
      fireEvent.change(screen.getByTestId('sale-additional-expense-category'), {
        target: { value: 'cat-frete' },
      });
      fireEvent.change(
        screen.getByTestId('sale-additional-expense-description'),
        { target: { value: 'Frete da venda' } },
      );
      fireEvent.change(screen.getByLabelText('Descrição da Venda'), {
        target: { value: 'Descrição da venda' },
      });
      fireEvent.change(screen.getByLabelText('Data de entrega'), {
        target: { value: '2026-03-20' },
      });

      const combobox = screen.getByPlaceholderText('Busque um produto...');
      fireEvent.change(combobox, { target: { value: 'Lavanda' } });
      fireEvent.mouseDown(screen.getByText(/Óleo de Lavanda/));
      fireEvent.change(screen.getByPlaceholderText('0,00'), {
        target: { value: '17500' },
      });

      const form = screen.getByTestId('sale-freight').closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          '/sales',
          expect.objectContaining({
            clientPersonId: 'p1',
            orderDate: '2026-03-10',
            shippingValue: 25.5,
            additionalValue: 10,
            additionalExpenseCategoryId: 'cat-frete',
            additionalExpenseDescription: 'Frete da venda',
            description: 'Descrição da venda',
            deliveredAt: '2026-03-20',
            items: [
              expect.objectContaining({
                productId: 'prod-2',
                chargedValue: 175,
                memberPrice: 180,
                quantity: 1,
                chargedValueMode: 'UNIT',
              }),
            ],
          }),
        );
      });
    });

    it('should send null for empty optional fields', async () => {
      mockPost.mockResolvedValue({
        data: { id: '4', orderNumber: 'V-0004' },
      });
      renderPage();
      await openCreateModal();

      fireEvent.change(screen.getByLabelText('Cliente'), {
        target: { value: 'p1' },
      });
      const combobox = screen.getByPlaceholderText('Busque um produto...');
      fireEvent.change(combobox, { target: { value: 'Lavanda' } });
      fireEvent.mouseDown(screen.getByText(/Óleo de Lavanda/));
      fireEvent.change(screen.getByPlaceholderText('0,00'), {
        target: { value: '5000' },
      });

      const form = screen.getByTestId('sale-freight').closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          '/sales',
          expect.objectContaining({
            shippingValue: 0,
            additionalValue: 0,
            description: null,
            deliveredAt: null,
          }),
        );
      });
    });

    it('should show the backend insufficient-stock error as a toast', async () => {
      mockPost.mockRejectedValue({
        response: {
          data: {
            error:
              'Estoque insuficiente para Óleo de Lavanda: disponível 1, necessário 3',
          },
        },
      });
      renderPage();
      await openCreateModal();

      fireEvent.change(screen.getByLabelText('Cliente'), {
        target: { value: 'p1' },
      });
      const combobox = screen.getByPlaceholderText('Busque um produto...');
      fireEvent.change(combobox, { target: { value: 'Lavanda' } });
      fireEvent.mouseDown(screen.getByText(/Óleo de Lavanda/));
      fireEvent.change(screen.getByTestId('sale-item-quantity-0'), {
        target: { value: '3' },
      });
      fireEvent.change(screen.getByPlaceholderText('0,00'), {
        target: { value: '17500' },
      });

      const form = screen.getByTestId('sale-freight').closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(
          screen.getByText(
            'Estoque insuficiente para Óleo de Lavanda: disponível 1, necessário 3',
          ),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Additional value expense', () => {
    const fillItemAndAdditional = () => {
      fireEvent.change(screen.getByLabelText('Cliente'), {
        target: { value: 'p1' },
      });
      const combobox = screen.getByPlaceholderText('Busque um produto...');
      fireEvent.change(combobox, { target: { value: 'Lavanda' } });
      fireEvent.mouseDown(screen.getByText(/Óleo de Lavanda/));
      fireEvent.change(screen.getByPlaceholderText('0,00'), {
        target: { value: '10000' },
      });
      fireEvent.change(screen.getByTestId('sale-additional'), {
        target: { value: '500' },
      });
    };

    it('should show the expense fields only when the additional value is filled', async () => {
      mockGetImplementation([]);
      renderPage();
      await openCreateModal();

      expect(
        screen.queryByTestId('sale-additional-expense-category'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('sale-additional-expense-description'),
      ).not.toBeInTheDocument();

      fireEvent.change(screen.getByTestId('sale-additional'), {
        target: { value: '500' },
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('sale-additional-expense-category'),
        ).toBeInTheDocument();
      });
      expect(
        screen.getByTestId('sale-additional-expense-description'),
      ).toBeInTheDocument();
    });

    it('should only offer active DESPESA categories', async () => {
      mockGetImplementation([]);
      renderPage();
      await openCreateModal();
      fireEvent.change(screen.getByTestId('sale-additional'), {
        target: { value: '500' },
      });

      const select = await screen.findByTestId(
        'sale-additional-expense-category',
      );
      const optionLabels = within(select)
        .getAllByRole('option')
        .map((option) => option.textContent);
      expect(optionLabels).toContain('Frete');
      expect(optionLabels).toContain('Marketing');
      expect(optionLabels).not.toContain('Eventos');
      expect(optionLabels).not.toContain('Vendas');
    });

    it('should block submit when the expense category and description are missing', async () => {
      mockGetImplementation([]);
      renderPage();
      await openCreateModal();
      fillItemAndAdditional();

      const form = screen.getByTestId('sale-freight').closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(
          screen.getByTestId('sale-additional-expense-category-error'),
        ).toHaveTextContent('Categoria da despesa é obrigatória');
      });
      expect(
        screen.getByTestId('sale-additional-expense-description-error'),
      ).toHaveTextContent('Descrição da despesa é obrigatória');
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('should pre-fill the expense fields when editing a sale', async () => {
      mockGetImplementation(mockSales);
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByText('Maria Santos').length).toBeGreaterThan(0);
      });
      await clickSaleAction('2', 'Editar');
      await waitFor(() => {
        expect(screen.getByText('Editar Venda')).toBeInTheDocument();
      });
      expect(screen.getByTestId('sale-additional-expense-category').value).toBe(
        'cat-frete',
      );
      expect(
        screen.getByTestId('sale-additional-expense-description').value,
      ).toBe('Frete da venda');
    });
  });

  describe('Non-chargeable additional value', () => {
    const fillItemAndAdditional = () => {
      fireEvent.change(screen.getByLabelText('Cliente'), {
        target: { value: 'p1' },
      });
      const combobox = screen.getByPlaceholderText('Busque um produto...');
      fireEvent.change(combobox, { target: { value: 'Lavanda' } });
      fireEvent.mouseDown(screen.getByText(/Óleo de Lavanda/));
      fireEvent.change(screen.getByPlaceholderText('0,00'), {
        target: { value: '10000' },
      });
      fireEvent.change(screen.getByTestId('sale-additional'), {
        target: { value: '500' },
      });
    };

    it('should offer the checkbox only with an additional value and keep it checked by default', async () => {
      mockGetImplementation([]);
      renderPage();
      await openCreateModal();

      expect(
        screen.queryByTestId('sale-additional-charged'),
      ).not.toBeInTheDocument();

      fireEvent.change(screen.getByTestId('sale-additional'), {
        target: { value: '500' },
      });

      await waitFor(() => {
        expect(screen.getByTestId('sale-additional-charged')).toBeChecked();
      });
    });

    it('should drop the additional value from the total when it is not charged', async () => {
      mockGetImplementation([]);
      renderPage();
      await openCreateModal();
      fillItemAndAdditional();

      await waitFor(() => {
        expect(screen.getByTestId('sale-totals-total')).toHaveTextContent(
          /105,00/,
        );
      });

      fireEvent.click(screen.getByTestId('sale-additional-charged'));

      await waitFor(() => {
        expect(screen.getByTestId('sale-totals-total')).toHaveTextContent(
          /100,00/,
        );
      });
    });

    it('should send additionalValueChargedToClient false when unchecked', async () => {
      mockPost.mockResolvedValue({
        data: { id: '9', orderNumber: 'V-0009' },
      });
      mockGetImplementation([]);
      renderPage();
      await openCreateModal();
      fillItemAndAdditional();
      fireEvent.change(screen.getByTestId('sale-additional-expense-category'), {
        target: { value: 'cat-frete' },
      });
      fireEvent.change(
        screen.getByTestId('sale-additional-expense-description'),
        { target: { value: 'Custo absorvido' } },
      );
      fireEvent.click(screen.getByTestId('sale-additional-charged'));

      const form = screen.getByTestId('sale-freight').closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          '/sales',
          expect.objectContaining({ additionalValueChargedToClient: false }),
        );
      });
    });

    it('should pre-fill the checkbox as unchecked when editing a non-chargeable sale', async () => {
      const nonChargeable = {
        ...mockSales[1],
        totalValue: '495.00',
        additionalValueChargedToClient: false,
      };
      mockGetImplementation([nonChargeable]);
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByText('Maria Santos').length).toBeGreaterThan(0);
      });
      await clickSaleAction('2', 'Editar');
      await waitFor(() => {
        expect(screen.getByText('Editar Venda')).toBeInTheDocument();
      });
      expect(screen.getByTestId('sale-additional-charged')).not.toBeChecked();
    });
  });

  describe('Polite close on create', () => {
    const typeDescription = () => {
      fireEvent.change(screen.getByLabelText('Descrição da Venda'), {
        target: { value: 'venda com alteração' },
      });
    };

    it('should close immediately on Escape when nothing was changed', async () => {
      mockGetImplementation([]);
      renderPage();
      await openCreateModal();
      fireEvent.keyDown(window, { key: 'Escape' });
      await waitFor(() => {
        expect(screen.queryByText('Itens da Venda')).not.toBeInTheDocument();
      });
    });

    it('should close immediately via the form Cancel button when nothing was changed', async () => {
      mockGetImplementation([]);
      renderPage();
      await openCreateModal();
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      await waitFor(() => {
        expect(screen.queryByText('Itens da Venda')).not.toBeInTheDocument();
      });
    });

    it('should ask for confirmation on Escape after a change was made', async () => {
      mockGetImplementation([]);
      renderPage();
      await openCreateModal();
      typeDescription();
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.getByText('Descartar alterações?')).toBeInTheDocument();
      expect(screen.getByText('Itens da Venda')).toBeInTheDocument();
    });

    it('should ask for confirmation on backdrop click after a change was made', async () => {
      mockGetImplementation([]);
      renderPage();
      await openCreateModal();
      typeDescription();
      fireEvent.mouseDown(screen.getByTestId('modal-backdrop'));
      expect(screen.getByText('Descartar alterações?')).toBeInTheDocument();
      expect(screen.getByText('Itens da Venda')).toBeInTheDocument();
    });

    it('should ask for confirmation on the close button after a change was made', async () => {
      mockGetImplementation([]);
      renderPage();
      await openCreateModal();
      typeDescription();
      fireEvent.click(screen.getByRole('button', { name: 'Fechar venda' }));
      expect(screen.getByText('Descartar alterações?')).toBeInTheDocument();
      expect(screen.getByText('Itens da Venda')).toBeInTheDocument();
    });

    it('should route the form Cancel button through the dirty check after a change', async () => {
      mockGetImplementation([]);
      renderPage();
      await openCreateModal();
      typeDescription();
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(screen.getByText('Descartar alterações?')).toBeInTheDocument();
      expect(screen.getByText('Itens da Venda')).toBeInTheDocument();
    });

    it('should close and lose the changes after confirming the discard', async () => {
      mockGetImplementation([]);
      renderPage();
      await openCreateModal();
      typeDescription();
      fireEvent.keyDown(window, { key: 'Escape' });
      fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
      await waitFor(() => {
        expect(screen.queryByText('Itens da Venda')).not.toBeInTheDocument();
      });
    });

    it('should keep the modal open and preserve the changes when cancelling the discard', async () => {
      mockGetImplementation([]);
      renderPage();
      await openCreateModal();
      typeDescription();
      fireEvent.keyDown(window, { key: 'Escape' });
      fireEvent.click(
        screen.getByRole('button', { name: 'Continuar editando' }),
      );
      expect(
        screen.queryByText('Descartar alterações?'),
      ).not.toBeInTheDocument();
      expect(screen.getByText('Itens da Venda')).toBeInTheDocument();
      expect(screen.getByLabelText('Descrição da Venda').value).toBe(
        'venda com alteração',
      );
    });
  });

  describe('Sale items', () => {
    it('should add a new item row when clicking "Adicionar Item"', async () => {
      mockGetImplementation([]);
      renderPage();
      await openCreateModal();
      fireEvent.click(screen.getByText('Adicionar Item'));
      await waitFor(() => {
        expect(screen.getByText('Item 2')).toBeInTheDocument();
      });
    });

    it('should remove an item row when clicking "Remover"', async () => {
      mockGetImplementation([]);
      renderPage();
      await openCreateModal();
      fireEvent.click(screen.getByText('Adicionar Item'));
      await waitFor(() => {
        const removeButtons = screen.getAllByText('Remover');
        expect(removeButtons).toHaveLength(2);
      });
      fireEvent.click(screen.getAllByText('Remover')[1]);
      await waitFor(() => {
        expect(screen.queryByText('Item 2')).not.toBeInTheDocument();
      });
    });

    it('should compute the total as products + freight + additional in cents', async () => {
      mockGetImplementation([]);
      renderPage();
      await openCreateModal();
      const combobox = screen.getByPlaceholderText('Busque um produto...');
      fireEvent.change(combobox, { target: { value: 'Lavanda' } });
      fireEvent.mouseDown(screen.getByText(/Óleo de Lavanda/));
      fireEvent.change(screen.getByPlaceholderText('0,00'), {
        target: { value: '10000' },
      });
      fireEvent.change(screen.getByTestId('sale-freight'), {
        target: { value: '1050' },
      });
      fireEvent.change(screen.getByTestId('sale-additional'), {
        target: { value: '450' },
      });
      await waitFor(() => {
        expect(screen.getByTestId('sale-totals-total')).toHaveTextContent(
          /115,00/,
        );
      });
    });
  });

  describe('Sale kit items', () => {
    const selectKit = () => {
      const combobox = screen.getByPlaceholderText('Busque um produto...');
      fireEvent.change(combobox, { target: { value: 'Kit Bem-Estar' } });
      fireEvent.mouseDown(screen.getByText(/Kit Bem-Estar/));
    };

    it('should not render the kit stock mode radios for a KIT product', async () => {
      mockGetImplementation([]);
      renderPage();
      await openCreateModal();
      selectKit();
      await waitFor(() => {
        expect(
          screen.getByDisplayValue('Kit Bem-Estar (60226099)'),
        ).toBeInTheDocument();
      });
      expect(
        screen.queryByText('Como enviar para o estoque?'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('sale-item-kit-mode-kit-0'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('sale-item-kit-mode-components-0'),
      ).not.toBeInTheDocument();
    });

    it('should send kitStockMode KIT in the create payload for a KIT product', async () => {
      mockPost.mockResolvedValue({
        data: { id: '5', orderNumber: 'V-0005' },
      });
      mockGetImplementation([]);
      renderPage();
      await openCreateModal();
      fireEvent.change(screen.getByLabelText('Cliente'), {
        target: { value: 'p1' },
      });
      selectKit();
      fireEvent.change(screen.getByPlaceholderText('0,00'), {
        target: { value: '20000' },
      });

      const form = screen.getByTestId('sale-freight').closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          '/sales',
          expect.objectContaining({
            items: [
              expect.objectContaining({
                productId: 'prod-kit',
                kitStockMode: 'KIT',
              }),
            ],
          }),
        );
      });
    });

    it('should normalize a legacy COMPONENTS kit item to KIT when updating a sale', async () => {
      mockPut.mockResolvedValue({
        data: { id: 'sale-kit', orderNumber: 'V-KIT1' },
      });
      mockGetImplementation([kitSale]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });
      await clickSaleAction('sale-kit', 'Editar');
      await waitFor(() => {
        expect(screen.getByText('Editar Venda')).toBeInTheDocument();
      });
      expect(
        screen.queryByText('Como enviar para o estoque?'),
      ).not.toBeInTheDocument();

      const form = screen.getByTestId('sale-freight').closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith(
          '/sales/sale-kit',
          expect.objectContaining({
            items: [
              expect.objectContaining({
                id: 'kit-item-1',
                productId: 'prod-kit',
                kitStockMode: 'KIT',
              }),
            ],
          }),
        );
      });
    });
  });

  describe('Sale item cashback', () => {
    const setupItem = async () => {
      mockGetImplementation([]);
      renderPage();
      await openCreateModal();
      fireEvent.change(screen.getByLabelText('Cliente'), {
        target: { value: 'p1' },
      });
      const combobox = screen.getByPlaceholderText('Busque um produto...');
      fireEvent.change(combobox, { target: { value: 'Lavanda' } });
      fireEvent.mouseDown(screen.getByText(/Óleo de Lavanda/));
    };

    it('should render the cashback checkbox unchecked by default', async () => {
      await setupItem();
      expect(screen.getByTestId('sale-item-cashback-0')).not.toBeChecked();
      expect(screen.queryByDisplayValue('R$ 54,00')).not.toBeInTheDocument();
    });

    it('should show the 70%-off member total when checked and hide it when unchecked', async () => {
      await setupItem();
      fireEvent.click(screen.getByTestId('sale-item-cashback-0'));
      await waitFor(() => {
        expect(screen.getByDisplayValue('R$ 54,00')).toBeInTheDocument();
      });
      expect(screen.getByText('Valor 70%')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('sale-item-cashback-0'));
      await waitFor(() => {
        expect(screen.queryByDisplayValue('R$ 54,00')).not.toBeInTheDocument();
      });
    });

    it('should scale the 70%-off member total with the quantity', async () => {
      await setupItem();
      fireEvent.click(screen.getByTestId('sale-item-cashback-0'));
      fireEvent.change(screen.getByTestId('sale-item-quantity-0'), {
        target: { value: '2' },
      });
      await waitFor(() => {
        expect(screen.getByDisplayValue('R$ 108,00')).toBeInTheDocument();
      });
    });

    it('should send useCashback true in the item payload when checked', async () => {
      mockPost.mockResolvedValue({
        data: { id: '3', orderNumber: 'V-0003' },
      });
      await setupItem();
      fireEvent.click(screen.getByTestId('sale-item-cashback-0'));
      const form = screen.getByTestId('sale-freight').closest('form');
      fireEvent.submit(form);
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          '/sales',
          expect.objectContaining({
            items: [
              expect.objectContaining({
                productId: 'prod-2',
                useCashback: true,
              }),
            ],
          }),
        );
      });
    });

    it('should send useCashback false in the item payload when unchecked', async () => {
      mockPost.mockResolvedValue({
        data: { id: '4', orderNumber: 'V-0004' },
      });
      await setupItem();
      const form = screen.getByTestId('sale-freight').closest('form');
      fireEvent.submit(form);
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          '/sales',
          expect.objectContaining({
            items: [
              expect.objectContaining({
                productId: 'prod-2',
                useCashback: false,
              }),
            ],
          }),
        );
      });
    });

    it('should keep the charged value untouched when toggling the checkbox', async () => {
      await setupItem();
      fireEvent.change(screen.getByPlaceholderText('0,00'), {
        target: { value: '10000' },
      });
      expect(screen.getByPlaceholderText('0,00')).toHaveValue('100,00');
      fireEvent.click(screen.getByTestId('sale-item-cashback-0'));
      expect(screen.getByPlaceholderText('0,00')).toHaveValue('100,00');
    });

    it('should reflect the stored cashback flag when editing a sale', async () => {
      mockGetImplementation(mockSales);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });
      await clickSaleAction('1', 'Editar');
      await waitFor(() => {
        expect(screen.getByText('Editar Venda')).toBeInTheDocument();
      });
      expect(screen.getByTestId('sale-item-cashback-0')).not.toBeChecked();
      expect(screen.getByTestId('sale-item-cashback-1')).toBeChecked();
      expect(screen.getByDisplayValue('R$ 54,00')).toBeInTheDocument();
    });
  });

  describe('Edit Sale', () => {
    beforeEach(() => {
      mockGetImplementation(mockSales);
    });

    it('should open the edit modal pre-filled with sale data', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });
      await clickSaleAction('1', 'Editar');
      await waitFor(() => {
        expect(screen.getByText('Editar Venda')).toBeInTheDocument();
      });
      expect(screen.getByLabelText('Cliente').value).toBe('p1');
      expect(screen.getByLabelText('Data do Pedido').value).toBe('2026-05-15');
      expect(
        screen.getByDisplayValue('Adaptiv Pastilhas (60226006)'),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Descrição da Venda').value).toBe(
        'Venda de teste',
      );
    });

    it('should pre-fill the delivery date when editing a delivered sale', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByText('Maria Santos').length).toBeGreaterThan(0);
      });
      await clickSaleAction('2', 'Editar');
      await waitFor(() => {
        expect(screen.getByText('Editar Venda')).toBeInTheDocument();
      });
      expect(screen.getByLabelText('Data de entrega').value).toBe('2026-06-25');
    });

    it('should send the update payload preserving existing item ids', async () => {
      mockPut.mockResolvedValue({ data: { id: '1', orderNumber: 'V-0001' } });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });
      await clickSaleAction('1', 'Editar');
      await waitFor(() => {
        expect(screen.getByText('Editar Venda')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByTestId('sale-freight'), {
        target: { value: '1250' },
      });
      const form = screen.getByTestId('sale-freight').closest('form');
      fireEvent.submit(form);
      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith(
          '/sales/1',
          expect.objectContaining({
            shippingValue: 12.5,
            items: [
              expect.objectContaining({ id: 'i1', productId: 'prod-1' }),
              expect.objectContaining({ id: 'i2', productId: 'prod-2' }),
            ],
          }),
        );
      });
    });
  });

  describe('Delete Sale', () => {
    beforeEach(() => {
      mockGetImplementation(mockSales);
    });

    it('should call the delete API when confirming deletion', async () => {
      mockDelete.mockResolvedValue({
        data: { message: 'Sale order deleted successfully' },
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });
      await clickSaleAction('1', 'Excluir');
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalledWith('/sales/1');
      });
    });

    it('should not delete when the user cancels', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });
      await clickSaleAction('1', 'Excluir');
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });

  describe('Delivery actions', () => {
    it('should mark a sale as delivered via PUT', async () => {
      mockPut.mockResolvedValue({ data: { id: '1', orderNumber: 'V-0001' } });
      mockGetImplementation(mockSales);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });
      await clickSaleAction('1', 'Marcar-como-entregue');
      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith('/sales/1', {
          deliveredAt: todayDate(),
        });
      });
    });

    it('should unmark the delivery via PUT with null', async () => {
      mockPut.mockResolvedValue({ data: { id: '2', orderNumber: 'V-0002' } });
      mockGetImplementation(mockSales);
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByText('Maria Santos').length).toBeGreaterThan(0);
      });
      await clickSaleAction('2', 'Desmarcar-entrega');
      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith('/sales/2', { deliveredAt: null });
      });
    });
  });

  describe('Sale form product list', () => {
    it('should request only products that exist in stock (available + inStock)', async () => {
      mockGetImplementation([]);
      renderPage();
      await waitFor(() => {
        const productCalls = mockGet.mock.calls.filter(([url]) =>
          url.startsWith('/products'),
        );
        expect(productCalls.length).toBeGreaterThan(0);
        productCalls.forEach(([url]) => {
          expect(url).toContain('available=true');
          expect(url).toContain('inStock=true');
        });
      });
    });
  });

  describe('Search, filters and sorting (server-side)', () => {
    it('should fetch sales with the committed search term on submit', async () => {
      mockGetImplementation(mockSales);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });
      const initialCalls = mockGet.mock.calls.filter(
        ([url]) => url === '/sales',
      );

      fireEvent.change(screen.getByLabelText('Buscar vendas'), {
        target: { value: 'V-0002' },
      });
      fireEvent.submit(screen.getByLabelText('Filtros de vendas'));

      await waitFor(() => {
        const saleCalls = mockGet.mock.calls.filter(
          ([url]) => url === '/sales',
        );
        expect(saleCalls.length).toBeGreaterThan(initialCalls.length);
      });
      const lastSaleCall = mockGet.mock.calls
        .filter(([url]) => url === '/sales')
        .at(-1);
      expect(lastSaleCall[1].params.q).toBe('V-0002');
    });

    it('should refetch immediately when the status filter changes', async () => {
      mockGetImplementation(mockSales);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByLabelText('Status'), {
        target: { value: 'QUITADO' },
      });
      await waitFor(() => {
        const last = mockGet.mock.calls
          .filter(([url]) => url === '/sales')
          .at(-1);
        expect(last[1].params.status).toBe('QUITADO');
      });
    });

    it('should refetch immediately when the delivery filter changes', async () => {
      mockGetImplementation(mockSales);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByLabelText('Entrega'), {
        target: { value: 'false' },
      });
      await waitFor(() => {
        const last = mockGet.mock.calls
          .filter(([url]) => url === '/sales')
          .at(-1);
        expect(last[1].params.delivered).toBe('false');
      });
    });

    it('should combine an active filter with a sort in a single request', async () => {
      mockGetImplementation(mockSales);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });
      fireEvent.change(screen.getByLabelText('Status'), {
        target: { value: 'QUITADO' },
      });
      await waitFor(() => {
        const calls = mockGet.mock.calls.filter(([url]) => url === '/sales');
        expect(calls.at(-1)[1].params.status).toBe('QUITADO');
      });
      fireEvent.click(screen.getByTestId('sales-sort-totalValue'));
      await waitFor(() => {
        const last = mockGet.mock.calls
          .filter(([url]) => url === '/sales')
          .at(-1);
        expect(last[1].params.status).toBe('QUITADO');
        expect(last[1].params.sortBy).toBe('totalValue');
        expect(last[1].params.sortDir).toBe('asc');
      });
    });

    it('should show the filtered empty state when no sale matches', async () => {
      mockGetImplementation([]);
      renderPage();
      await waitFor(() => {
        expect(
          screen.getByText('Nenhuma venda cadastrada'),
        ).toBeInTheDocument();
      });
      fireEvent.change(screen.getByLabelText('Buscar vendas'), {
        target: { value: 'NãoExiste' },
      });
      fireEvent.submit(screen.getByLabelText('Filtros de vendas'));
      await waitFor(() => {
        expect(
          screen.getByText(
            'Nenhuma venda encontrada para os filtros aplicados.',
          ),
        ).toBeInTheDocument();
      });
    });
  });
});
