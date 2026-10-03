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
  ...overrides,
});

const categories = [
  { id: 'cat-transporte', name: 'Transporte', type: 'DESPESA', active: true },
  { id: 'cat-outras', name: 'Outras despesas', type: 'DESPESA', active: true },
  { id: 'cat-vendas', name: 'Vendas', type: 'RECEITA', active: true },
];

const mockApi = ({ rides = [], cats = categories } = {}) => {
  mockGet.mockImplementation((url) => {
    if (url === '/uber/rides') return Promise.resolve({ data: rides });
    if (url === '/finances/categories') return Promise.resolve({ data: cats });
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

  it('marks an already launched ride', async () => {
    mockApi({
      rides: [ride({ launched: true, transactionId: 'tx-1' })],
    });
    renderPage();

    expect(
      await screen.findByTestId('uber-ride-launched-ride-1'),
    ).toHaveTextContent('Lançada');
    expect(screen.getByTestId('uber-ride-select-ride-1')).toBeDisabled();
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

  it('launches the selected rides as expenses with the default category', async () => {
    mockApi({ rides: [ride()] });
    mockPost.mockResolvedValue({ data: [{ id: 'tx-1' }] });
    renderPage();

    const checkbox = await screen.findByTestId('uber-ride-select-ride-1');
    fireEvent.click(checkbox);

    const panel = await screen.findByTestId('uber-ride-selected-ride-1');
    expect(within(panel).getByTestId('uber-ride-category-ride-1')).toHaveValue(
      'cat-transporte',
    );

    fireEvent.click(screen.getByTestId('uber-ride-launch'));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/uber/rides/expenses', {
        items: [
          {
            rideId: 'ride-1',
            categoryId: 'cat-transporte',
            description: 'Uber — Duo Residence Mall (Cássia)',
          },
        ],
      }),
    );
  });

  it('blocks launching when nothing is selected', async () => {
    mockApi({ rides: [ride()] });
    renderPage();

    await screen.findByText('Duo Residence Mall');
    // No selection panel and no launch button before selecting.
    expect(screen.queryByTestId('uber-ride-launch')).not.toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
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
});
