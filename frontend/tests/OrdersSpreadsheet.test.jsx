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
import { ORDER_ENTRY_MODE_KEY } from '../src/pages/Orders/useOrderEntryMode';

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
    productType: 'SIMPLES',
  },
  {
    id: 'prod-2',
    name: 'Óleo de Lavanda',
    code: '60226007',
    memberPrice: '180.00',
    pv: '30',
    status: 'ATIVO',
    productType: 'SIMPLES',
  },
  {
    id: 'prod-kit',
    name: 'Kit Início',
    code: 'KIT001',
    memberPrice: '300.00',
    pv: '50',
    status: 'ATIVO',
    productType: 'KIT',
  },
];

const mockGetImplementation = (ordersData = []) => {
  mockGet.mockImplementation((url) => {
    if (url === '/orders') return Promise.resolve({ data: ordersData });
    if (url === '/people') return Promise.resolve({ data: mockPeople });
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

const selectEntryMode = (value) => {
  fireEvent.click(
    screen.getByTestId(
      value === 'spreadsheet'
        ? 'order-entry-mode-spreadsheet'
        : 'order-entry-mode-detailed',
    ),
  );
};

const switchToSpreadsheet = async () => {
  selectEntryMode('spreadsheet');
  await waitFor(() => {
    expect(screen.getByText('Manter como padrão?')).toBeInTheDocument();
  });
  fireEvent.click(screen.getByRole('button', { name: 'Só desta vez' }));
  await waitFor(() => {
    expect(screen.getByTestId('order-spreadsheet-add-row')).toBeInTheDocument();
  });
};

const selectProduct = async (name) => {
  const combobox = screen.getByPlaceholderText('Busque um produto...');
  fireEvent.change(combobox, { target: { value: name } });
  fireEvent.mouseDown(screen.getByText(new RegExp(name)));
  await waitFor(() => {
    expect(screen.getByText('Limpar produto')).toBeInTheDocument();
  });
};

const submitForm = () => {
  const form = screen
    .getByPlaceholderText('Informe o número do pedido da dōTERRA')
    .closest('form');
  fireEvent.submit(form);
};

describe('Order spreadsheet entry mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('defaults to the detailed form', async () => {
    mockGetImplementation([]);
    renderPage();
    await openCreateModal();

    expect(screen.getByTestId('order-entry-mode-detailed')).toBeChecked();
    expect(
      screen.queryByTestId('order-spreadsheet-add-row'),
    ).not.toBeInTheDocument();
  });

  it('switches to the spreadsheet when the user picks Planilha', async () => {
    mockGetImplementation([]);
    renderPage();
    await openCreateModal();
    await switchToSpreadsheet();

    expect(screen.getByTestId('order-entry-mode-spreadsheet')).toBeChecked();
    expect(screen.getByTestId('order-spreadsheet-row-0')).toBeInTheDocument();
    expect(screen.getByText('Soma dos PV')).toBeInTheDocument();
    expect(screen.getByTestId('order-freight')).toBeInTheDocument();
  });

  it('saves the spreadsheet as default when the user confirms', async () => {
    mockGetImplementation([]);
    renderPage();
    await openCreateModal();

    selectEntryMode('spreadsheet');
    await waitFor(() => {
      expect(screen.getByText('Manter como padrão?')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Manter como padrão' }));

    expect(localStorage.getItem(ORDER_ENTRY_MODE_KEY)).toBe('spreadsheet');
  });

  it('does not change the default when the user declines', async () => {
    mockGetImplementation([]);
    renderPage();
    await openCreateModal();
    await switchToSpreadsheet();

    expect(localStorage.getItem(ORDER_ENTRY_MODE_KEY)).toBeNull();
  });

  it('warns about unsaved items before switching when edits are in progress', async () => {
    mockGetImplementation([]);
    renderPage();
    await openCreateModal();

    fireEvent.change(screen.getByTestId('order-item-quantity-0'), {
      target: { value: '2' },
    });
    selectEntryMode('spreadsheet');

    expect(screen.getByText('Trocar o modo de inclusão')).toBeInTheDocument();
    expect(
      screen.queryByTestId('order-spreadsheet-add-row'),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Trocar' }));
    await waitFor(() => {
      expect(
        screen.getByTestId('order-spreadsheet-add-row'),
      ).toBeInTheDocument();
    });
  });

  it('does not warn when only a shared order field was filled in', async () => {
    mockGetImplementation([]);
    renderPage();
    await openCreateModal();

    fireEvent.change(
      screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
      { target: { value: 'ORD-SHARED' } },
    );
    selectEntryMode('spreadsheet');

    expect(
      screen.queryByText('Trocar o modo de inclusão'),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByTestId('order-spreadsheet-add-row'),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByPlaceholderText('Informe o número do pedido da dōTERRA')
        .value,
    ).toBe('ORD-SHARED');
  });

  it('keeps the current mode when the switch is cancelled', async () => {
    mockGetImplementation([]);
    renderPage();
    await openCreateModal();

    fireEvent.change(screen.getByTestId('order-item-quantity-0'), {
      target: { value: '2' },
    });
    selectEntryMode('spreadsheet');
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Cancelar',
      }),
    );

    expect(screen.getByTestId('order-entry-mode-detailed')).toBeChecked();
    expect(screen.getByTestId('order-item-quantity-0')).toHaveValue('2');
  });

  it('derives the member and PV totals from the selected product', async () => {
    mockGetImplementation([]);
    renderPage();
    await openCreateModal();
    await switchToSpreadsheet();

    await selectProduct('Adaptiv Pastilhas');

    expect(
      screen.getByTestId('order-spreadsheet-pv-total-0'),
    ).toHaveTextContent('15,00');
    expect(
      screen.getByTestId('order-spreadsheet-member-total-0'),
    ).toHaveTextContent(/R\$\s*90,00/);
    expect(screen.getByTestId('order-spreadsheet-total-pv')).toHaveTextContent(
      '15,00',
    );
  });

  it('applies the promotion to the charged value and the member total', async () => {
    mockGetImplementation([]);
    renderPage();
    await openCreateModal();
    await switchToSpreadsheet();

    await selectProduct('Óleo de Lavanda');
    fireEvent.change(screen.getByTestId('order-spreadsheet-discount-0'), {
      target: { value: '70' },
    });

    expect(
      screen.getByTestId('order-spreadsheet-member-unit-0'),
    ).toHaveTextContent(/R\$\s*54,00/);
    expect(screen.getByTestId('order-totals-charged-footer')).toHaveTextContent(
      /R\$\s*54,00/,
    );
  });

  it('shows the stock-mode select only for KIT products', async () => {
    mockGetImplementation([]);
    renderPage();
    await openCreateModal();
    await switchToSpreadsheet();

    expect(
      screen.queryByTestId('order-spreadsheet-kit-mode-0'),
    ).not.toBeInTheDocument();

    await selectProduct('Kit Início');

    expect(
      screen.getByTestId('order-spreadsheet-kit-mode-0'),
    ).toBeInTheDocument();
  });

  it('exposes the paid value, stock and details fields of the detailed form', async () => {
    mockGetImplementation([]);
    renderPage();
    await openCreateModal();
    await switchToSpreadsheet();

    expect(
      screen.getByTestId('order-spreadsheet-charged-0'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('order-spreadsheet-charged-total-0'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('order-spreadsheet-stock-0')).toBeInTheDocument();
    expect(
      screen.getByTestId('order-spreadsheet-details-0'),
    ).toBeInTheDocument();
  });

  it('prefills the paid value on product select and lets the user override it', async () => {
    mockGetImplementation([]);
    renderPage();
    await openCreateModal();
    await switchToSpreadsheet();

    await selectProduct('Óleo de Lavanda');

    expect(screen.getByTestId('order-spreadsheet-charged-0')).toHaveValue(
      '180,00',
    );
    expect(
      screen.getByTestId('order-spreadsheet-charged-total-0'),
    ).toHaveTextContent(/R\$\s*180,00/);

    fireEvent.change(screen.getByTestId('order-spreadsheet-charged-0'), {
      target: { value: '15000' },
    });

    expect(
      screen.getByTestId('order-spreadsheet-charged-total-0'),
    ).toHaveTextContent(/R\$\s*150,00/);
  });

  it('checks the stock flag by default for a selected product', async () => {
    mockGetImplementation([]);
    renderPage();
    await openCreateModal();
    await switchToSpreadsheet();

    expect(screen.getByTestId('order-spreadsheet-stock-0')).not.toBeChecked();
    await selectProduct('Óleo de Lavanda');
    expect(screen.getByTestId('order-spreadsheet-stock-0')).toBeChecked();
  });

  it('hides the stock flag on team orders', async () => {
    mockGetImplementation([]);
    renderPage();
    await openCreateModal();
    await switchToSpreadsheet();

    fireEvent.click(screen.getByTestId('order-is-team-order'));

    expect(
      screen.queryByTestId('order-spreadsheet-stock-0'),
    ).not.toBeInTheDocument();
  });

  it('sends the edited paid value and details in the payload', async () => {
    mockGetImplementation([]);
    mockPost.mockResolvedValue({ data: { id: 'new-detail' } });
    renderPage();
    await openCreateModal();
    await switchToSpreadsheet();

    fireEvent.change(
      screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
      { target: { value: 'ORD-DETAIL' } },
    );
    await selectProduct('Óleo de Lavanda');
    fireEvent.change(screen.getByTestId('order-spreadsheet-charged-0'), {
      target: { value: '15000' },
    });
    fireEvent.change(screen.getByTestId('order-spreadsheet-details-0'), {
      target: { value: 'Promo' },
    });
    submitForm();

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/orders',
        expect.objectContaining({
          items: [
            expect.objectContaining({
              chargedValue: 150,
              chargedValueMode: 'UNIT',
              details: 'Promo',
            }),
          ],
        }),
      );
    });
  });

  it('creates the order with the converted spreadsheet items', async () => {
    mockGetImplementation([]);
    mockPost.mockResolvedValue({ data: { id: 'new-1' } });
    renderPage();
    await openCreateModal();
    await switchToSpreadsheet();

    fireEvent.change(
      screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
      { target: { value: 'ORD-SHEET' } },
    );
    await selectProduct('Óleo de Lavanda');
    fireEvent.change(screen.getByTestId('order-spreadsheet-quantity-0'), {
      target: { value: '2' },
    });

    submitForm();

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/orders',
        expect.objectContaining({
          orderNumber: 'ORD-SHEET',
          items: [
            expect.objectContaining({
              productId: 'prod-2',
              chargedValue: 180,
              memberPrice: 180,
              quantity: 2,
              forStock: true,
              chargedValueMode: 'UNIT',
              personId: null,
            }),
          ],
        }),
      );
    });
  });

  it('requires at least one product before saving', async () => {
    mockGetImplementation([]);
    renderPage();
    await openCreateModal();
    await switchToSpreadsheet();

    fireEvent.change(
      screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
      { target: { value: 'ORD-EMPTY-SHEET' } },
    );
    submitForm();

    await waitFor(() => {
      expect(screen.getByTestId('order-spreadsheet-error')).toHaveTextContent(
        'Adicione ao menos um produto ao pedido',
      );
    });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('requires a KIT stock mode before saving a kit line', async () => {
    mockGetImplementation([]);
    renderPage();
    await openCreateModal();
    await switchToSpreadsheet();

    fireEvent.change(
      screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
      { target: { value: 'ORD-KIT' } },
    );
    await selectProduct('Kit Início');
    submitForm();

    await waitFor(() => {
      expect(
        screen.getByText('Escolha como enviar o kit para o estoque'),
      ).toBeInTheDocument();
    });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('sends the KIT stock mode when chosen', async () => {
    mockGetImplementation([]);
    mockPost.mockResolvedValue({ data: { id: 'new-kit' } });
    renderPage();
    await openCreateModal();
    await switchToSpreadsheet();

    fireEvent.change(
      screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
      { target: { value: 'ORD-KIT2' } },
    );
    await selectProduct('Kit Início');
    fireEvent.change(screen.getByTestId('order-spreadsheet-kit-mode-0'), {
      target: { value: 'COMPONENTS' },
    });
    submitForm();

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/orders',
        expect.objectContaining({
          items: [
            expect.objectContaining({
              productId: 'prod-kit',
              forStock: true,
              kitStockMode: 'COMPONENTS',
            }),
          ],
        }),
      );
    });
  });

  it('binds every spreadsheet item to the team client on a team order', async () => {
    mockGetImplementation([]);
    mockPost.mockResolvedValue({ data: { id: 'new-team' } });
    renderPage();
    await openCreateModal();
    await switchToSpreadsheet();

    fireEvent.change(
      screen.getByPlaceholderText('Informe o número do pedido da dōTERRA'),
      { target: { value: 'ORD-TEAM-SHEET' } },
    );
    fireEvent.click(screen.getByTestId('order-is-team-order'));
    fireEvent.change(screen.getByTestId('order-team-person'), {
      target: { value: 'p1' },
    });
    await selectProduct('Óleo de Lavanda');
    submitForm();

    await waitFor(() => {
      const payload = mockPost.mock.calls.find(([url]) => url === '/orders')[1];
      expect(payload.isTeamOrder).toBe(true);
      expect(payload.items).toHaveLength(1);
      expect(payload.items[0]).toEqual(
        expect.objectContaining({ personId: 'p1', forStock: false }),
      );
    });
  });

  it('hydrates the spreadsheet rows when editing an order', async () => {
    const order = {
      id: '9',
      orderNumber: 'ORD-EDIT-SHEET',
      orderDate: '2026-05-15T00:00:00.000Z',
      totalValue: '162.00',
      status: 'PENDENTE',
      accountOwner: null,
      paymentType: null,
      orderNotes: null,
      attachmentFilename: null,
      items: [
        {
          id: 'it-1',
          description: 'Óleo de Lavanda',
          chargedValue: '162.00',
          personId: 'p1',
          person: { name: 'João' },
          productId: 'prod-2',
          product: mockProducts[1],
          memberPrice: '180.00',
          quantity: 1,
          forStock: true,
          chargedValueMode: 'UNIT',
        },
      ],
    };
    mockGetImplementation([order]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('ORD-EDIT-SHEET')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('order-actions-9-trigger'));
    await waitFor(() => {
      expect(
        screen.getByTestId('order-actions-9-item-Editar'),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('order-actions-9-item-Editar'));
    await waitFor(() => {
      expect(screen.getByText('Editar Pedido')).toBeInTheDocument();
    });

    await switchToSpreadsheet();

    expect(screen.getByTestId('order-spreadsheet-row-0')).toBeInTheDocument();
    expect(
      screen.getByTestId('order-spreadsheet-member-unit-0'),
    ).toHaveTextContent(/R\$\s*162,00/);
    expect(screen.getByTestId('order-spreadsheet-discount-0')).toHaveValue(
      '10',
    );
  });
});
