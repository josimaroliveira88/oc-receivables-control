import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FinancesPage from '../src/pages/FinancesPage';
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

const categories = [
  {
    id: 'cat-vendas',
    name: 'Vendas',
    type: 'RECEITA',
    isDefault: true,
    active: true,
  },
  {
    id: 'cat-bonus',
    name: 'Bônus dōTERRA',
    type: 'RECEITA',
    isDefault: true,
    active: true,
  },
  {
    id: 'cat-doterra',
    name: 'Compra de produtos dōTERRA',
    type: 'DESPESA',
    isDefault: true,
    active: true,
  },
  {
    id: 'cat-viagens',
    name: 'Viagens',
    type: 'DESPESA',
    isDefault: false,
    active: true,
  },
];

const transactions = [
  {
    id: 't-venda',
    type: 'RECEITA',
    origin: 'VENDA',
    amount: '100.00',
    description: 'Venda V-0001 — João Silva',
    transactionDate: '2026-09-10T00:00:00.000Z',
    notes: null,
    categoryId: 'cat-vendas',
    category: { id: 'cat-vendas', name: 'Vendas', type: 'RECEITA' },
    orderId: 'order-1',
    paymentId: 'pay-1',
    feeAmount: '3.00',
  },
  {
    id: 't-doterra',
    type: 'DESPESA',
    origin: 'PEDIDO_DOTERRA',
    amount: '250.00',
    description: 'Pedido dōTERRA P-0007',
    transactionDate: '2026-09-05T00:00:00.000Z',
    notes: null,
    categoryId: 'cat-doterra',
    category: {
      id: 'cat-doterra',
      name: 'Compra de produtos dōTERRA',
      type: 'DESPESA',
    },
    orderId: 'order-2',
    paymentId: null,
    feeAmount: null,
  },
  {
    id: 't-manual',
    type: 'RECEITA',
    origin: 'MANUAL',
    amount: '80.00',
    description: 'Bônus dōTERRA',
    transactionDate: '2026-09-12T00:00:00.000Z',
    notes: 'Setembro',
    categoryId: 'cat-bonus',
    category: { id: 'cat-bonus', name: 'Bônus dōTERRA', type: 'RECEITA' },
    orderId: null,
    paymentId: null,
    feeAmount: null,
  },
  {
    id: 't-uber',
    type: 'DESPESA',
    origin: 'UBER',
    amount: '32.93',
    description: 'Uber — Duo Residence Mall (Cássia)',
    transactionDate: '2026-09-26T00:00:00.000Z',
    notes: null,
    categoryId: 'cat-doterra',
    category: {
      id: 'cat-doterra',
      name: 'Compra de produtos dōTERRA',
      type: 'DESPESA',
    },
    orderId: 'order-1',
    rideId: 'ride-1',
    ride: {
      requestedAt: '2026-09-26T16:02:00.000Z',
      destination: 'Duo Residence Mall',
      riderName: 'Cássia',
      rideType: 'RIDE',
    },
    paymentId: null,
    feeAmount: null,
  },
];

// A ride already converted into a pending credit-card purchase (charge date in
// `transactionDate`, invoice date in `effectiveDate`).
const cardTransaction = {
  id: 't-uber-card',
  type: 'DESPESA',
  origin: 'UBER',
  amount: '32.93',
  description: 'Uber — Duo Residence Mall (Cássia)',
  transactionDate: '2026-09-27T00:00:00.000Z',
  effectiveDate: '2026-10-05T00:00:00.000Z',
  paymentType: 'CARTAO_CREDITO',
  isEffective: false,
  notes: null,
  categoryId: 'cat-doterra',
  category: {
    id: 'cat-doterra',
    name: 'Compra de produtos dōTERRA',
    type: 'DESPESA',
  },
  orderId: null,
  rideId: 'ride-1',
  ride: {
    requestedAt: '2026-09-26T16:02:00.000Z',
    destination: 'Duo Residence Mall',
    riderName: 'Cássia',
    rideType: 'RIDE',
  },
  paymentId: null,
  feeAmount: null,
};

const summary = {
  totalIncome: '180.00',
  totalExpense: '250.00',
  balance: '-70.00',
};

const sales = [
  {
    id: 'order-1',
    orderNumber: 'V-0001',
    orderDate: '2026-09-01',
    totalValue: '613.12',
    status: 'QUITADO',
    items: [
      {
        id: 'i1',
        description: 'Adaptiv',
        chargedValue: '613.12',
        quantity: 1,
        person: { name: 'João Silva' },
        personId: 'p1',
      },
    ],
    payments: [
      {
        id: 'pay-1',
        paymentType: 'INFINITE_PAY',
        amount: '613.12',
        netAmount: '600.00',
        paidAt: '2026-09-02',
      },
    ],
  },
  {
    id: 'order-pix',
    orderNumber: 'V-0002',
    orderDate: '2026-09-03',
    totalValue: '50.00',
    status: 'QUITADO',
    items: [],
    payments: [{ id: 'pay-2', paymentType: 'PIX', amount: '50.00' }],
  },
];

const mockGetImplementation = ({
  transactionRows = transactions,
  categoryRows = categories,
  summaryData = summary,
  salesRows = sales,
} = {}) => {
  mockGet.mockImplementation((url) => {
    if (url === '/finances/categories')
      return Promise.resolve({ data: categoryRows });
    if (url === '/finances/transactions')
      return Promise.resolve({ data: transactionRows });
    if (url === '/finances/summary')
      return Promise.resolve({ data: summaryData });
    if (url === '/sales') return Promise.resolve({ data: salesRows });
    if (url === '/api-tokens') return Promise.resolve({ data: [] });
    if (url === '/uber/rides') return Promise.resolve({ data: [] });
    return Promise.resolve({ data: [] });
  });
};

const renderPage = (initialEntries = ['/finances']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <ToastProvider>
        <FinancesPage />
      </ToastProvider>
    </MemoryRouter>,
  );

const waitForTable = async () => {
  await waitFor(() =>
    expect(screen.getByText('Venda V-0001 — João Silva')).toBeInTheDocument(),
  );
};

describe('FinancesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the page title and summary totals', async () => {
    mockGetImplementation();
    renderPage();
    await waitForTable();

    expect(screen.getByText('Finanças')).toBeInTheDocument();
    expect(screen.getByTestId('finances-summary-income')).toHaveTextContent(
      /180,00/,
    );
    expect(screen.getByTestId('finances-summary-expense')).toHaveTextContent(
      /250,00/,
    );
    expect(screen.getByTestId('finances-summary-balance')).toHaveTextContent(
      /-R\$\s*70,00/,
    );
  });

  it('lists transactions with type, origin and category', async () => {
    mockGetImplementation();
    renderPage();
    await waitForTable();

    expect(screen.getByText('Venda V-0001 — João Silva')).toBeInTheDocument();
    expect(screen.getByText('Pedido dōTERRA P-0007')).toBeInTheDocument();
    expect(screen.getAllByText('Venda').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pedido dōTERRA').length).toBeGreaterThan(0);
  });

  it('shows the derived fee for linked payments', async () => {
    mockGetImplementation();
    renderPage();
    await waitForTable();
    expect(screen.getByTestId('transaction-fee-t-venda')).toHaveTextContent(
      /3,00/,
    );
  });

  it('shows an origin link only for automatic linked rows', async () => {
    mockGetImplementation();
    renderPage();
    await waitForTable();

    expect(screen.getByTestId('transaction-link-t-venda')).toBeInTheDocument();
    expect(
      screen.getByTestId('transaction-link-t-doterra'),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('transaction-link-t-manual'),
    ).not.toBeInTheDocument();
  });

  it('deep-links sales to the sale details and orders to the order details', async () => {
    mockGetImplementation();
    renderPage();
    await waitForTable();

    expect(screen.getByTestId('transaction-link-t-venda')).toHaveAttribute(
      'href',
      '/sales?detailsSale=order-1',
    );
    expect(screen.getByTestId('transaction-link-t-doterra')).toHaveAttribute(
      'href',
      '/orders?detailsOrder=order-2',
    );
  });

  it('shows an action menu for every row, with details as the first item', async () => {
    mockGetImplementation();
    renderPage();
    await waitForTable();

    expect(
      screen.getByTestId('transaction-actions-t-manual-trigger'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('transaction-actions-t-venda-trigger'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('transaction-actions-t-doterra-trigger'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('transaction-actions-t-uber-trigger'),
    ).toBeInTheDocument();

    // Automatic sale row: details plus description-only editing.
    fireEvent.click(screen.getByTestId('transaction-actions-t-venda-trigger'));
    expect(
      screen.getByTestId('transaction-actions-t-venda-item-Ver-detalhes'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('transaction-actions-t-venda-item-Editar-descricao'),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('transaction-actions-t-venda-item-Excluir'),
    ).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });

    // Manual row: "Ver detalhes" comes before Editar/Excluir.
    fireEvent.click(screen.getByTestId('transaction-actions-t-manual-trigger'));
    expect(
      screen.getByTestId('transaction-actions-t-manual-item-Ver-detalhes'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('transaction-actions-t-manual-item-Editar'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('transaction-actions-t-manual-item-Excluir'),
    ).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });

    // dōTERRA order row: details plus description-only editing.
    fireEvent.click(
      screen.getByTestId('transaction-actions-t-doterra-trigger'),
    );
    expect(
      screen.getByTestId('transaction-actions-t-doterra-item-Ver-detalhes'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('transaction-actions-t-doterra-item-Editar-descricao'),
    ).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });

    // Uber row: fully editable (but for type/origin) and deletable.
    fireEvent.click(screen.getByTestId('transaction-actions-t-uber-trigger'));
    expect(
      screen.getByTestId('transaction-actions-t-uber-item-Editar'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('transaction-actions-t-uber-item-Excluir'),
    ).toBeInTheDocument();
  });

  it('refetches with the committed filters', async () => {
    mockGetImplementation();
    renderPage();
    await waitForTable();

    const before = mockGet.mock.calls.filter(
      ([url]) => url === '/finances/transactions',
    ).length;

    fireEvent.change(screen.getByLabelText('Tipo'), {
      target: { value: 'RECEITA' },
    });
    fireEvent.change(screen.getByLabelText('Origem'), {
      target: { value: 'MANUAL' },
    });

    await waitFor(() => {
      const calls = mockGet.mock.calls.filter(
        ([url]) => url === '/finances/transactions',
      );
      expect(calls.length).toBeGreaterThan(before);
      expect(calls.at(-1)[1].params.type).toBe('RECEITA');
      expect(calls.at(-1)[1].params.origin).toBe('MANUAL');
    });

    const summaryCall = mockGet.mock.calls
      .filter(([url]) => url === '/finances/summary')
      .at(-1);
    expect(summaryCall[1].params.type).toBe('RECEITA');
  });

  it('submits the search only on user action', async () => {
    mockGetImplementation();
    renderPage();
    await waitForTable();

    const before = mockGet.mock.calls.filter(
      ([url]) => url === '/finances/transactions',
    ).length;

    fireEvent.change(screen.getByLabelText('Buscar lançamentos'), {
      target: { value: 'bônus' },
    });
    fireEvent.submit(screen.getByLabelText('Filtros de lançamentos'));

    await waitFor(() => {
      const calls = mockGet.mock.calls.filter(
        ([url]) => url === '/finances/transactions',
      );
      expect(calls.length).toBeGreaterThan(before);
      expect(calls.at(-1)[1].params.q).toBe('bônus');
    });
  });

  it('shows the filtered empty state', async () => {
    mockGetImplementation({ transactionRows: [] });
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByText('Nenhum lançamento cadastrado'),
      ).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText('Tipo'), {
      target: { value: 'DESPESA' },
    });

    await waitFor(() =>
      expect(
        screen.getByText(
          'Nenhum lançamento encontrado para os filtros aplicados.',
        ),
      ).toBeInTheDocument(),
    );
  });

  it('opens the Uber rides welcome orientation on the first visit', async () => {
    mockGetImplementation();
    renderPage();
    await waitForTable();

    fireEvent.click(screen.getByTestId('finances-uber-import-open'));

    expect(
      await screen.findByTestId('uber-rides-welcome-modal'),
    ).toBeInTheDocument();
  });

  it('opens the Uber rides import modal from the header button after dismissing the orientation', async () => {
    mockGetImplementation();
    localStorage.setItem('uber-rides-welcome-dismissed', 'true');
    renderPage();
    await waitForTable();

    fireEvent.click(screen.getByTestId('finances-uber-import-open'));

    expect(
      await screen.findByTestId('uber-rides-embedded-modal'),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('uber-ride-import-modal'),
    ).toBeInTheDocument();
  });

  it('opens the Uber rides flow when the legacy query param is present', async () => {
    mockGetImplementation();
    localStorage.setItem('uber-rides-welcome-dismissed', 'true');
    renderPage(['/finances?openUberImport=1']);
    await waitForTable();

    expect(
      await screen.findByTestId('uber-rides-embedded-modal'),
    ).toBeInTheDocument();
  });

  describe('manual transaction modal', () => {
    const openCreate = async () => {
      await waitForTable();
      fireEvent.click(screen.getByRole('button', { name: 'Novo lançamento' }));
      await screen.findByText('Novo lançamento', { selector: 'h3' });
    };

    it('creates a manual expense with the masked amount', async () => {
      mockPost.mockResolvedValue({
        data: {
          ...transactions[2],
          id: 't-new',
          type: 'DESPESA',
          origin: 'MANUAL',
          amount: '35.50',
          description: 'Material',
        },
      });
      mockGetImplementation();
      renderPage();
      await openCreate();

      const modal = screen.getByTestId('transaction-form-modal');
      fireEvent.change(within(modal).getByLabelText('Tipo'), {
        target: { value: 'DESPESA' },
      });
      fireEvent.change(within(modal).getByLabelText('Descrição'), {
        target: { value: 'Material' },
      });
      fireEvent.change(within(modal).getByTestId('transaction-amount'), {
        target: { value: '3550' },
      });
      fireEvent.change(within(modal).getByLabelText('Data'), {
        target: { value: '2026-09-18' },
      });
      fireEvent.change(within(modal).getByLabelText('Categoria'), {
        target: { value: 'cat-viagens' },
      });

      const form = within(modal)
        .getByTestId('transaction-amount')
        .closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/finances/transactions', {
          type: 'DESPESA',
          amount: 35.5,
          description: 'Material',
          transactionDate: '2026-09-18',
          categoryId: 'cat-viagens',
          notes: null,
        });
      });
    });

    it('validates required fields before calling the API', async () => {
      mockGetImplementation();
      renderPage();
      await openCreate();

      const form = screen.getByTestId('transaction-amount').closest('form');
      fireEvent.submit(form);

      expect(
        await screen.findByTestId('transaction-form-error'),
      ).toHaveTextContent('Informe a descrição');
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('edits a manual row', async () => {
      mockPut.mockResolvedValue({
        data: { ...transactions[2], description: 'Bônus atualizado' },
      });
      mockGetImplementation();
      renderPage();
      await waitForTable();

      fireEvent.click(
        screen.getByTestId('transaction-actions-t-manual-trigger'),
      );
      fireEvent.click(
        screen.getByTestId('transaction-actions-t-manual-item-Editar'),
      );

      await screen.findByText('Editar lançamento', { selector: 'h3' });
      expect(screen.getByLabelText('Descrição')).toHaveValue('Bônus dōTERRA');
      // The credit-card tab is a create-only affordance.
      expect(
        screen.queryByRole('button', { name: 'Cartão de crédito' }),
      ).not.toBeInTheDocument();
      expect(
        within(screen.getByTestId('transaction-form-modal')).getByLabelText(
          'Tipo',
        ),
      ).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Descrição'), {
        target: { value: 'Bônus atualizado' },
      });
      const form = screen.getByTestId('transaction-amount').closest('form');
      fireEvent.submit(form);

      await waitFor(() =>
        expect(mockPut).toHaveBeenCalledWith(
          '/finances/transactions/t-manual',
          {
            type: 'RECEITA',
            amount: 80,
            description: 'Bônus atualizado',
            transactionDate: '2026-09-12',
            categoryId: 'cat-bonus',
            notes: 'Setembro',
          },
        ),
      );
    });

    it('deletes a manual row after confirmation', async () => {
      mockDelete.mockResolvedValue({ data: { message: 'ok' } });
      mockGetImplementation();
      renderPage();
      await waitForTable();

      fireEvent.click(
        screen.getByTestId('transaction-actions-t-manual-trigger'),
      );
      fireEvent.click(
        screen.getByTestId('transaction-actions-t-manual-item-Excluir'),
      );

      expect(await screen.findByText('Excluir lançamento')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));

      await waitFor(() =>
        expect(mockDelete).toHaveBeenCalledWith(
          '/finances/transactions/t-manual',
        ),
      );
    });

    it('asks to discard before closing with unsaved changes', async () => {
      mockGetImplementation();
      renderPage();
      await openCreate();

      fireEvent.change(screen.getByLabelText('Descrição'), {
        target: { value: 'rascunho' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

      expect(
        await screen.findByText('Descartar alterações?'),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
      await waitFor(() =>
        expect(
          screen.queryByTestId('transaction-form-modal'),
        ).not.toBeInTheDocument(),
      );
    });
  });

  describe('automatic row editing', () => {
    it('edits only the description of an automatic sale row', async () => {
      mockPut.mockResolvedValue({
        data: { ...transactions[0], description: 'Venda ajustada' },
      });
      mockGetImplementation();
      renderPage();
      await waitForTable();

      fireEvent.click(
        screen.getByTestId('transaction-actions-t-venda-trigger'),
      );
      fireEvent.click(
        screen.getByTestId('transaction-actions-t-venda-item-Editar-descricao'),
      );

      await screen.findByText('Editar descrição', { selector: 'h3' });
      // Only the description is editable for automatic rows.
      expect(
        screen.queryByTestId('transaction-amount'),
      ).not.toBeInTheDocument();
      expect(
        within(screen.getByTestId('transaction-form-modal')).queryByLabelText(
          'Tipo',
        ),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Cartão de crédito' }),
      ).not.toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Descrição'), {
        target: { value: 'Venda ajustada' },
      });
      const form = screen.getByLabelText('Descrição').closest('form');
      fireEvent.submit(form);

      await waitFor(() =>
        expect(mockPut).toHaveBeenCalledWith('/finances/transactions/t-venda', {
          description: 'Venda ajustada',
        }),
      );
    });

    it('edits an Uber row without changing its type or origin', async () => {
      mockPut.mockResolvedValue({
        data: { ...transactions[3], amount: '40.00' },
      });
      mockGetImplementation();
      renderPage();
      await waitForTable();

      fireEvent.click(screen.getByTestId('transaction-actions-t-uber-trigger'));
      fireEvent.click(
        screen.getByTestId('transaction-actions-t-uber-item-Editar'),
      );

      await screen.findByText('Editar lançamento', { selector: 'h3' });
      // Type is fixed for Uber rows, so no type selector is offered.
      expect(
        within(screen.getByTestId('transaction-form-modal')).queryByLabelText(
          'Tipo',
        ),
      ).not.toBeInTheDocument();

      fireEvent.change(screen.getByTestId('transaction-amount'), {
        target: { value: '4000' },
      });
      const form = screen.getByTestId('transaction-amount').closest('form');
      fireEvent.submit(form);

      await waitFor(() =>
        expect(mockPut).toHaveBeenCalledWith('/finances/transactions/t-uber', {
          amount: 40,
          description: 'Uber — Duo Residence Mall (Cássia)',
          transactionDate: '2026-09-26',
          categoryId: 'cat-doterra',
          notes: null,
          paymentType: null,
          effectiveDate: null,
        }),
      );
    });

    it('converts an Uber row to a pending credit-card purchase', async () => {
      mockPut.mockResolvedValue({
        data: { ...transactions[3], paymentType: 'CARTAO_CREDITO' },
      });
      mockGetImplementation();
      renderPage();
      await waitForTable();

      fireEvent.click(screen.getByTestId('transaction-actions-t-uber-trigger'));
      fireEvent.click(
        screen.getByTestId('transaction-actions-t-uber-item-Editar'),
      );
      await screen.findByText('Editar lançamento', { selector: 'h3' });

      // The card tab is offered for Uber rows in edit mode.
      fireEvent.click(
        screen.getByRole('button', { name: 'Cartão de crédito' }),
      );

      fireEvent.change(screen.getByLabelText('Data do lançamento no cartão'), {
        target: { value: '2026-09-27' },
      });
      fireEvent.change(screen.getByLabelText('Data da fatura'), {
        target: { value: '2026-10-05' },
      });
      const form = screen.getByTestId('transaction-amount').closest('form');
      fireEvent.submit(form);

      await waitFor(() =>
        expect(mockPut).toHaveBeenCalledWith('/finances/transactions/t-uber', {
          amount: 32.93,
          description: 'Uber — Duo Residence Mall (Cássia)',
          transactionDate: '2026-09-27',
          categoryId: 'cat-doterra',
          notes: null,
          paymentType: 'CARTAO_CREDITO',
          effectiveDate: '2026-10-05',
        }),
      );
    });

    it('requires the invoice date before converting to credit card', async () => {
      mockGetImplementation();
      renderPage();
      await waitForTable();

      fireEvent.click(screen.getByTestId('transaction-actions-t-uber-trigger'));
      fireEvent.click(
        screen.getByTestId('transaction-actions-t-uber-item-Editar'),
      );
      await screen.findByText('Editar lançamento', { selector: 'h3' });
      fireEvent.click(
        screen.getByRole('button', { name: 'Cartão de crédito' }),
      );

      const form = screen.getByTestId('transaction-amount').closest('form');
      fireEvent.submit(form);

      expect(
        await screen.findByTestId('transaction-form-error'),
      ).toHaveTextContent('Informe a data da fatura');
      expect(mockPut).not.toHaveBeenCalled();
    });

    it('reverts a card Uber row to a plain entry', async () => {
      mockPut.mockResolvedValue({
        data: { ...cardTransaction, paymentType: null, effectiveDate: null },
      });
      mockGetImplementation({ transactionRows: [cardTransaction] });
      renderPage();
      await screen.findByText('Uber — Duo Residence Mall (Cássia)');

      fireEvent.click(
        screen.getByTestId('transaction-actions-t-uber-card-trigger'),
      );
      fireEvent.click(
        screen.getByTestId('transaction-actions-t-uber-card-item-Editar'),
      );
      await screen.findByText('Editar lançamento', { selector: 'h3' });

      // Opens on the card tab; "Lançamento simples" clears the payment state.
      fireEvent.click(
        screen.getByRole('button', { name: 'Lançamento simples' }),
      );
      fireEvent.submit(
        screen.getByTestId('transaction-amount').closest('form'),
      );

      await waitFor(() =>
        expect(mockPut).toHaveBeenCalledWith(
          '/finances/transactions/t-uber-card',
          {
            amount: 32.93,
            description: 'Uber — Duo Residence Mall (Cássia)',
            transactionDate: '2026-09-27',
            categoryId: 'cat-doterra',
            notes: null,
            paymentType: null,
            effectiveDate: null,
          },
        ),
      );
    });

    it('shows the ride and invoice dates of a card Uber row', async () => {
      mockGetImplementation({ transactionRows: [cardTransaction] });
      renderPage();
      await screen.findByText('Uber — Duo Residence Mall (Cássia)');

      expect(
        screen.getByTestId('transaction-ride-date-t-uber-card'),
      ).toHaveTextContent('Corrida: 26/09/2026');
      expect(
        screen.getByTestId('transaction-invoice-t-uber-card'),
      ).toHaveTextContent('Fatura: 05/10/2026');
      expect(
        screen.getByTestId('transaction-effectiveness-t-uber-card'),
      ).toHaveTextContent('Pendente');
    });

    it('settles a pending card Uber row from the action menu', async () => {
      mockPost.mockResolvedValue({
        data: { ...cardTransaction, isEffective: true },
      });
      mockGetImplementation({ transactionRows: [cardTransaction] });
      renderPage();
      await screen.findByText('Uber — Duo Residence Mall (Cássia)');

      fireEvent.click(
        screen.getByTestId('transaction-actions-t-uber-card-trigger'),
      );
      fireEvent.click(
        screen.getByTestId(
          'transaction-actions-t-uber-card-item-Baixar-como-paga',
        ),
      );

      await waitFor(() =>
        expect(mockPost).toHaveBeenCalledWith(
          '/finances/transactions/t-uber-card/pay',
        ),
      );
    });

    it('shows the ride and invoice dates in the details modal', async () => {
      mockGetImplementation({ transactionRows: [cardTransaction] });
      renderPage();
      await screen.findByText('Uber — Duo Residence Mall (Cássia)');

      fireEvent.click(
        screen.getByTestId('transaction-actions-t-uber-card-trigger'),
      );
      fireEvent.click(
        screen.getByTestId('transaction-actions-t-uber-card-item-Ver-detalhes'),
      );

      expect(
        await screen.findByTestId('transaction-details-ride-date'),
      ).toHaveTextContent('26/09/2026');
      expect(
        screen.getByTestId('transaction-details-effective-date'),
      ).toHaveTextContent('05/10/2026');
    });

    it('deletes an Uber row after confirmation', async () => {
      mockDelete.mockResolvedValue({ data: { message: 'ok' } });
      mockGetImplementation();
      renderPage();
      await waitForTable();

      fireEvent.click(screen.getByTestId('transaction-actions-t-uber-trigger'));
      fireEvent.click(
        screen.getByTestId('transaction-actions-t-uber-item-Excluir'),
      );

      expect(
        await screen.findByText(/corrida voltará a ficar disponível/i),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));

      await waitFor(() =>
        expect(mockDelete).toHaveBeenCalledWith(
          '/finances/transactions/t-uber',
        ),
      );
    });
  });
});
