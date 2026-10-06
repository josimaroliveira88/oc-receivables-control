import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UberRidesPage from '../src/pages/UberRidesPage';
import { ToastProvider } from '../src/components/Toast';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();

vi.mock('../src/services/api', () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    delete: (...args) => mockDelete(...args),
  },
}));

const match = (overrides = {}) => ({
  transactionId: 'tx-1',
  origin: 'MANUAL',
  description: 'Custo entrega',
  transactionDate: '2026-09-20T00:00:00.000Z',
  amountCents: 3293,
  orderId: null,
  orderNumber: null,
  clientName: null,
  saleTotalValue: null,
  ...overrides,
});

const ride = (overrides = {}) => ({
  id: 'ride-1',
  externalId: 'ext-1',
  status: 'COMPLETED',
  amountCents: 3293,
  destination: 'Duo Residence Mall',
  riderName: 'Cássia',
  profileType: 'FAMILY',
  rideType: 'RIDE',
  launched: false,
  transactionId: null,
  requestedAt: '2026-09-26T16:02:00.000Z',
  matches: [],
  ...overrides,
});

const categories = [
  { id: 'cat-transporte', name: 'Transporte', type: 'DESPESA', active: true },
  { id: 'cat-outras', name: 'Outras despesas', type: 'DESPESA', active: true },
  { id: 'cat-vendas', name: 'Vendas', type: 'RECEITA', active: true },
];

const mockApi = ({ rides = [], cats = categories, saleOptions = [] } = {}) => {
  mockGet.mockImplementation((url) => {
    if (url === '/uber/rides') return Promise.resolve({ data: rides });
    if (url === '/finances/categories') return Promise.resolve({ data: cats });
    if (url === '/sales/options') return Promise.resolve({ data: saleOptions });
    return Promise.resolve({ data: [] });
  });
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/uber-rides']}>
      <ToastProvider>
        <UberRidesPage />
      </ToastProvider>
    </MemoryRouter>,
  );

const renderEmbedded = () =>
  render(
    <MemoryRouter initialEntries={['/finances']}>
      <ToastProvider>
        <UberRidesPage embeddedOnly isOpen onClose={() => {}} />
      </ToastProvider>
    </MemoryRouter>,
  );

describe('UberRidesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the empty state when no ride was imported', async () => {
    mockApi({ rides: [] });
    renderPage();

    expect(
      await screen.findByText(/Nenhuma corrida importada/),
    ).toBeInTheDocument();
  });

  it('lists rides with amount, destination and status', async () => {
    mockApi({ rides: [ride()] });
    renderPage();

    expect(await screen.findByText('Duo Residence Mall')).toBeInTheDocument();
    expect(screen.getByText('Cássia')).toBeInTheDocument();
    expect(screen.getByTestId('uber-ride-amount-ride-1')).toHaveTextContent(
      /32,93/,
    );
    expect(screen.getByTestId('uber-ride-status-ride-1')).toHaveTextContent(
      'Concluída',
    );
    expect(screen.getByTestId('uber-ride-type-ride-1')).toHaveTextContent(
      'Passageiro',
    );
  });

  it('totalizes the rides according to the applied filter', async () => {
    mockApi({
      rides: [
        ride({ id: 'r1', amountCents: 3293, profileType: 'FAMILY' }),
        ride({
          id: 'r2',
          amountCents: 1000,
          profileType: 'PERSONAL',
          destination: 'Centro',
        }),
        ride({
          id: 'r3',
          amountCents: 500,
          profileType: 'FAMILY',
          destination: 'Aeroporto',
          launched: true,
          transactionId: 'tx-3',
        }),
      ],
    });
    renderPage();

    expect(
      await screen.findByTestId('uber-rides-filter-count'),
    ).toHaveTextContent('3');
    expect(screen.getByTestId('uber-rides-filter-total')).toHaveTextContent(
      /47,93/,
    );
    expect(screen.getByTestId('uber-rides-filter-pending')).toHaveTextContent(
      /42,93/,
    );

    fireEvent.change(screen.getByTestId('uber-ride-filter-profile'), {
      target: { value: 'FAMILY' },
    });

    expect(screen.getByTestId('uber-rides-filter-count')).toHaveTextContent(
      '2',
    );
    expect(screen.getByTestId('uber-rides-filter-total')).toHaveTextContent(
      /37,93/,
    );
    expect(screen.getByTestId('uber-rides-filter-pending')).toHaveTextContent(
      /32,93/,
    );
  });

  it('reflects the search filter in the totalizer', async () => {
    mockApi({
      rides: [
        ride({
          id: 'r1',
          amountCents: 3293,
          destination: 'Duo Residence Mall',
        }),
        ride({ id: 'r2', amountCents: 1000, destination: 'Centro' }),
      ],
    });
    renderPage();

    await screen.findByTestId('uber-rides-filter-count');
    fireEvent.change(screen.getByTestId('uber-ride-filter-search'), {
      target: { value: 'centro' },
    });

    expect(screen.getByTestId('uber-rides-filter-count')).toHaveTextContent(
      '1',
    );
    expect(screen.getByTestId('uber-rides-filter-total')).toHaveTextContent(
      /10,00/,
    );
  });

  it('flags a delivery ride', async () => {
    mockApi({ rides: [ride({ rideType: 'DELIVERY' })] });
    renderPage();

    expect(
      await screen.findByTestId('uber-ride-type-ride-1'),
    ).toHaveTextContent('Entrega');
  });

  it('marks an already launched ride and hides its expand control', async () => {
    mockApi({
      rides: [ride({ launched: true, transactionId: 'tx-1' })],
    });
    renderPage();

    expect(
      await screen.findByTestId('uber-ride-launched-ride-1'),
    ).toHaveTextContent('Lançada');
    expect(
      screen.queryByTestId('uber-ride-expand-ride-1'),
    ).not.toBeInTheDocument();
  });

  it('imports rides from the pasted JSON', async () => {
    mockApi({ rides: [] });
    mockPost.mockResolvedValue({
      data: { total: 2, created: 2, updated: 0, cancelled: 0, warnings: [] },
    });
    renderPage();

    // Dismiss the welcome orientation so "Importar corridas" opens the paste
    // modal directly (the standalone page owns its own button).
    localStorage.setItem('uber-rides-welcome-dismissed', 'true');
    await screen.findByText(/Nenhuma corrida importada/);
    fireEvent.click(screen.getByTestId('uber-ride-import-open'));

    const modal = await screen.findByTestId('uber-ride-import-modal');
    fireEvent.change(within(modal).getByTestId('uber-ride-import-json'), {
      target: { value: '{"profiles":{"FAMILY":{"atividades":[]}}}' },
    });
    fireEvent.click(within(modal).getByRole('button', { name: 'Importar' }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/uber/rides/import', {
        source: 'UBER_SESSION',
        json: '{"profiles":{"FAMILY":{"atividades":[]}}}',
        windowStart: undefined,
        windowEnd: undefined,
      }),
    );
  });

  it('summarizes created, updated and cancelled rides in the import toast', async () => {
    mockApi({ rides: [] });
    mockPost.mockResolvedValue({
      data: { total: 5, created: 3, updated: 2, cancelled: 1, warnings: [] },
    });
    renderPage();

    localStorage.setItem('uber-rides-welcome-dismissed', 'true');
    await screen.findByText(/Nenhuma corrida importada/);
    fireEvent.click(screen.getByTestId('uber-ride-import-open'));

    const modal = await screen.findByTestId('uber-ride-import-modal');
    fireEvent.change(within(modal).getByTestId('uber-ride-import-json'), {
      target: { value: '{"profiles":{"FAMILY":{"atividades":[]}}}' },
    });
    fireEvent.click(within(modal).getByRole('button', { name: 'Importar' }));

    expect(
      await screen.findByText(
        /5 corrida\(s\) processada\(s\) \(3 nova\(s\), 2 atualizada\(s\), 1 cancelada\(s\)\)/,
      ),
    ).toBeInTheDocument();
  });

  it('opens the inline row form by clicking the row', async () => {
    mockApi({ rides: [ride()] });
    renderPage();

    await screen.findByText('Duo Residence Mall');
    expect(
      screen.queryByTestId('uber-ride-form-ride-1'),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('uber-ride-row-ride-1'));

    expect(
      await screen.findByTestId('uber-ride-form-ride-1'),
    ).toBeInTheDocument();
  });

  it('launches a ride as an expense from the inline row form', async () => {
    mockApi({ rides: [ride()] });
    mockPost.mockResolvedValue({ data: [{ id: 'tx-1' }] });
    renderPage();

    fireEvent.click(await screen.findByTestId('uber-ride-expand-ride-1'));

    const form = await screen.findByTestId('uber-ride-form-ride-1');
    expect(within(form).getByTestId('uber-ride-category-ride-1')).toHaveValue(
      'cat-transporte',
    );
    // Credit card is the default payment, so the invoice date is required.
    expect(
      within(form).getByTestId('uber-ride-card-payment-ride-1'),
    ).toBeChecked();

    fireEvent.change(within(form).getByTestId('uber-ride-invoice-ride-1'), {
      target: { value: '2026-10-05' },
    });
    fireEvent.click(within(form).getByTestId('uber-ride-launch-ride-1'));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/uber/rides/expenses', {
        items: [
          {
            rideId: 'ride-1',
            categoryId: 'cat-transporte',
            description: 'Uber — Duo Residence Mall (Cássia)',
            orderId: null,
          },
        ],
        payment: { type: 'CARTAO_CREDITO', effectiveDate: '2026-10-05' },
      }),
    );
  });

  it('requires the invoice date for the default card payment', async () => {
    mockApi({ rides: [ride()] });
    renderPage();

    fireEvent.click(await screen.findByTestId('uber-ride-expand-ride-1'));
    fireEvent.click(await screen.findByTestId('uber-ride-launch-ride-1'));

    expect(
      await screen.findByText(/Informe a data da fatura/i),
    ).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('launches as a plain entry when the card payment is unchecked', async () => {
    mockApi({ rides: [ride()] });
    mockPost.mockResolvedValue({ data: [{ id: 'tx-1' }] });
    renderPage();

    fireEvent.click(await screen.findByTestId('uber-ride-expand-ride-1'));
    const form = await screen.findByTestId('uber-ride-form-ride-1');

    fireEvent.click(within(form).getByTestId('uber-ride-card-payment-ride-1'));
    fireEvent.click(within(form).getByTestId('uber-ride-launch-ride-1'));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/uber/rides/expenses', {
        items: [
          {
            rideId: 'ride-1',
            categoryId: 'cat-transporte',
            description: 'Uber — Duo Residence Mall (Cássia)',
            orderId: null,
          },
        ],
      }),
    );
  });

  it('links a ride to a sale through the autocomplete', async () => {
    mockApi({
      rides: [ride()],
      saleOptions: [
        {
          id: 'sale-9',
          orderNumber: 'V-0009',
          clientName: 'João',
          orderDate: '2026-09-20T00:00:00.000Z',
          totalValue: '100.00',
        },
      ],
    });
    mockPost.mockResolvedValue({ data: [{ id: 'tx-1' }] });
    renderPage();

    fireEvent.click(await screen.findByTestId('uber-ride-expand-ride-1'));
    const form = await screen.findByTestId('uber-ride-form-ride-1');

    const input = within(form).getByTestId('uber-ride-order-ride-1-input');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'V-00' } });

    const option = await screen.findByTestId(
      'uber-ride-order-ride-1-option-sale-9',
    );
    fireEvent.mouseDown(option);

    expect(input.value).toContain('V-0009 — João');
    expect(input.value).toContain('100,00');
    expect(mockGet).toHaveBeenCalledWith('/sales/options', {
      params: { q: 'V-00', limit: 20 },
    });

    fireEvent.change(within(form).getByTestId('uber-ride-invoice-ride-1'), {
      target: { value: '2026-10-05' },
    });
    fireEvent.click(within(form).getByTestId('uber-ride-launch-ride-1'));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/uber/rides/expenses', {
        items: [
          {
            rideId: 'ride-1',
            categoryId: 'cat-transporte',
            description: 'Uber — Duo Residence Mall (Cássia)',
            orderId: 'sale-9',
          },
        ],
        payment: { type: 'CARTAO_CREDITO', effectiveDate: '2026-10-05' },
      }),
    );
  });

  it('does not show a launch form before a row is opened', async () => {
    mockApi({ rides: [ride()] });
    renderPage();

    await screen.findByText('Duo Residence Mall');
    expect(
      screen.queryByTestId('uber-ride-form-ride-1'),
    ).not.toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('suggests a matching ledger row and reconciles it', async () => {
    mockApi({ rides: [ride({ matches: [match()] })] });
    mockPost.mockResolvedValue({ data: [{ id: 'tx-1' }] });
    renderPage();

    expect(
      await screen.findByTestId('uber-ride-match-ride-1'),
    ).toHaveTextContent('Conciliação sugerida');

    fireEvent.click(screen.getByTestId('uber-ride-expand-ride-1'));
    const form = await screen.findByTestId('uber-ride-form-ride-1');

    // The most recent suggestion is pre-selected.
    expect(
      within(form).getByTestId('uber-ride-match-option-tx-1'),
    ).toBeChecked();
    // No category/card in the reconcile path.
    expect(
      within(form).queryByTestId('uber-ride-category-ride-1'),
    ).not.toBeInTheDocument();

    fireEvent.click(within(form).getByTestId('uber-ride-reconcile-ride-1'));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/uber/rides/expenses', {
        items: [
          {
            rideId: 'ride-1',
            categoryId: null,
            description: 'Uber — Duo Residence Mall (Cássia)',
            orderId: null,
            matchTransactionId: 'tx-1',
          },
        ],
      }),
    );
  });

  it('shows the matched row sale read-only instead of the picker', async () => {
    mockApi({
      rides: [
        ride({
          matches: [
            match({
              orderId: 'sale-9',
              orderNumber: 'V-0009',
              clientName: 'João',
              saleTotalValue: '100.00',
            }),
          ],
        }),
      ],
    });
    renderPage();

    fireEvent.click(await screen.findByTestId('uber-ride-expand-ride-1'));
    const form = await screen.findByTestId('uber-ride-form-ride-1');

    expect(
      within(form).getByTestId('uber-ride-match-sale-ride-1'),
    ).toHaveTextContent('V-0009 — João');
    expect(
      within(form).queryByTestId('uber-ride-order-ride-1-input'),
    ).not.toBeInTheDocument();
  });

  it('offers the sale picker when the matched row has no sale', async () => {
    mockApi({ rides: [ride({ matches: [match()] })] });
    renderPage();

    fireEvent.click(await screen.findByTestId('uber-ride-expand-ride-1'));
    const form = await screen.findByTestId('uber-ride-form-ride-1');

    expect(
      within(form).getByTestId('uber-ride-order-ride-1-input'),
    ).toBeInTheDocument();
  });

  it('switches to a new expense when no suggestion is chosen', async () => {
    mockApi({ rides: [ride({ matches: [match()] })] });
    renderPage();

    fireEvent.click(await screen.findByTestId('uber-ride-expand-ride-1'));
    const form = await screen.findByTestId('uber-ride-form-ride-1');

    fireEvent.click(within(form).getByTestId('uber-ride-match-none-ride-1'));

    expect(
      within(form).getByTestId('uber-ride-category-ride-1'),
    ).toBeInTheDocument();
    expect(
      within(form).getByTestId('uber-ride-card-payment-ride-1'),
    ).toBeInTheDocument();
    expect(
      within(form).queryByTestId('uber-ride-reconcile-ride-1'),
    ).not.toBeInTheDocument();
    expect(
      within(form).getByTestId('uber-ride-launch-ride-1'),
    ).toBeInTheDocument();
  });

  it('reuses the last invoice date when opening the next row', async () => {
    let rides = [ride({ id: 'r1' }), ride({ id: 'r2', destination: 'Centro' })];
    mockGet.mockImplementation((url) => {
      if (url === '/uber/rides') return Promise.resolve({ data: rides });
      if (url === '/finances/categories')
        return Promise.resolve({ data: categories });
      return Promise.resolve({ data: [] });
    });
    mockPost.mockImplementation(() => {
      rides = [
        ride({ id: 'r1', launched: true, transactionId: 'tx-1' }),
        ride({ id: 'r2', destination: 'Centro' }),
      ];
      return Promise.resolve({ data: [{ id: 'tx-1' }] });
    });
    renderPage();

    fireEvent.click(await screen.findByTestId('uber-ride-expand-r1'));
    const first = await screen.findByTestId('uber-ride-form-r1');
    fireEvent.change(within(first).getByTestId('uber-ride-invoice-r1'), {
      target: { value: '2026-10-05' },
    });
    fireEvent.click(within(first).getByTestId('uber-ride-launch-r1'));

    fireEvent.click(await screen.findByTestId('uber-ride-expand-r2'));
    const second = await screen.findByTestId('uber-ride-form-r2');
    await waitFor(() =>
      expect(within(second).getByTestId('uber-ride-invoice-r2')).toHaveValue(
        '2026-10-05',
      ),
    );
  });

  it('renders the embedded variant with its own action bar', async () => {
    mockApi({ rides: [ride()] });
    renderEmbedded();

    // The embedded variant renders inside the modal with its own compact action
    // bar, so "Como capturar?" and the paste form remain reachable from there.
    expect(
      await screen.findByTestId('uber-rides-embedded-modal'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('uber-ride-import-open')).toBeInTheDocument();
    expect(screen.getByTestId('uber-ride-howto-open')).toBeInTheDocument();
    expect(screen.queryByText('Corridas Uber')).not.toBeInTheDocument();
    expect(screen.getByText('Duo Residence Mall')).toBeInTheDocument();
  });

  it('routes "Importar corridas" through the welcome orientation the first time', async () => {
    mockApi({ rides: [] });
    renderPage();

    await screen.findByText(/Nenhuma corrida importada/);
    fireEvent.click(screen.getByTestId('uber-ride-import-open'));

    expect(
      await screen.findByTestId('uber-rides-welcome-modal'),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('uber-ride-import-modal'),
    ).not.toBeInTheDocument();
  });

  it('reopens the welcome orientation from the "Como capturar?" link', async () => {
    mockApi({ rides: [] });
    localStorage.setItem('uber-rides-welcome-dismissed', 'true');
    renderPage();

    await screen.findByText(/Nenhuma corrida importada/);
    fireEvent.click(screen.getByTestId('uber-ride-howto-open'));

    expect(
      await screen.findByTestId('uber-rides-welcome-modal'),
    ).toBeInTheDocument();
  });

  it('does not offer removal for an already launched ride', async () => {
    mockApi({
      rides: [ride({ launched: true, transactionId: 'tx-1' })],
    });
    renderPage();

    await screen.findByTestId('uber-ride-launched-ride-1');
    expect(
      screen.queryByTestId('uber-ride-delete-ride-1'),
    ).not.toBeInTheDocument();
  });

  it('removes a discarded ride from the list after a successful delete', async () => {
    let rides = [ride()];
    mockGet.mockImplementation((url) => {
      if (url === '/uber/rides') return Promise.resolve({ data: rides });
      if (url === '/finances/categories')
        return Promise.resolve({ data: categories });
      return Promise.resolve({ data: [] });
    });
    mockDelete.mockImplementation(() => {
      rides = [];
      return Promise.resolve({ data: { id: 'ride-1', removed: true } });
    });
    renderPage();

    fireEvent.click(await screen.findByTestId('uber-ride-delete-ride-1'));

    await waitFor(() =>
      expect(mockDelete).toHaveBeenCalledWith('/uber/rides/ride-1'),
    );
    expect(await screen.findByText('Corrida removida.')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByTestId('uber-ride-delete-ride-1'),
      ).not.toBeInTheDocument(),
    );
  });

  it('shows an error toast and keeps the row when the delete fails', async () => {
    mockApi({ rides: [ride()] });
    mockDelete.mockRejectedValue({
      response: {
        data: {
          error:
            'Esta corrida já foi lançada no financeiro e não pode ser removida.',
        },
      },
    });
    renderPage();

    fireEvent.click(await screen.findByTestId('uber-ride-delete-ride-1'));

    expect(
      await screen.findByText(/não pode ser removida/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Duo Residence Mall')).toBeInTheDocument();
  });
});
